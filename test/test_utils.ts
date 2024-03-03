import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { exec } from "../src/utils";

export interface PkgJson {
  name: string;
  version: string;
  license: string;

  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  exports?: string | Record<string, string | Record<string, string>>;
  scripts?: Record<string, string>;
}

export interface DenoJson {
  name: string;
  version: string;
  exports: string | Record<string, string>;
}

/**
 * This sets the `packageManager` field in the `package.json` of the
 * specified directory to be the latest modern stable version of yarn.
 */
export async function enableYarnBerry(cwd: string) {
  await exec("yarn", ["set", "version", "berry"], cwd);
}

export async function runJsr(
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
) {
  const bin = path.join(__dirname, "..", "src", "bin.ts");
  const tsNode = path.join(__dirname, "..", "node_modules", ".bin", "ts-node");
  return await exec(tsNode, [bin, ...args], cwd, {
    ...process.env,
    npm_config_user_agent: undefined,
    ...env,
  });
}

export async function runInTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "jsr-cli"));

  await writeJson(path.join(dir, "package.json"), {
    name: "jsr-test-package",
    version: "0.0.1",
    license: "MIT",
  });
  try {
    await fn(dir);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

export async function withTempEnv(
  args: string[],
  fn: (getPkgJson: () => Promise<PkgJson>, dir: string) => Promise<void>,
  options: { env?: Record<string, string> } = {},
): Promise<void> {
  await runInTempDir(async (dir) => {
    await runJsr(args, dir, options.env);
    const pkgJson = async () =>
      readJson<PkgJson>(path.join(dir, "package.json"));
    await fn(pkgJson, dir);
  });
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(path)).isDirectory();
  } catch (err) {
    return false;
  }
}

export async function isFile(path: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(path)).isFile();
  } catch (err) {
    return false;
  }
}

export async function readJson<T>(file: string): Promise<T> {
  const content = await fs.promises.readFile(file, "utf-8");
  return JSON.parse(content);
}

export async function writeJson<T>(file: string, data: T): Promise<void> {
  await fs.promises.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}
