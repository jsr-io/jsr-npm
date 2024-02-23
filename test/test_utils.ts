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
}

export async function runJsr(
  args: string[],
  cwd: string,
  env: Record<string, string> = {
    ...process.env,
    npm_config_user_agent: "npm/",
  }
) {
  const bin = path.join(__dirname, "..", "src", "bin.ts");
  const tsNode = path.join(__dirname, "..", "node_modules", ".bin", "ts-node");
  return await exec(tsNode, [bin, ...args], cwd, env);
}

export async function runInTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "jsr-cli"));

  await fs.promises.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "jsr-test-package",
        version: "0.0.1",
        license: "MIT",
      },
      null,
      2
    ),
    "utf-8"
  );
  try {
    await fn(dir);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

export async function withTempEnv(
  args: string[],
  fn: (getPkgJson: () => Promise<PkgJson>, dir: string) => Promise<void>,
  options: { env?: Record<string, string> } = {}
): Promise<void> {
  await runInTempDir(async (dir) => {
    await runJsr(args, dir, options.env);
    const pkgJson = async () =>
      JSON.parse(
        await fs.promises.readFile(path.join(dir, "package.json"), "utf-8")
      ) as PkgJson;
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
