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

export async function runJsr(args: string[], cwd: string) {
  const bin = path.join(__dirname, "..", "src", "bin.ts");
  return await exec("npx", ["ts-node", bin, ...args], cwd);
}

export async function withTempEnv(
  args: string[],
  fn: (getPkgJson: () => Promise<PkgJson>, dir: string) => Promise<void>
): Promise<void> {
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
    await runJsr(args, dir);
    const pkgJson = async () =>
      JSON.parse(
        await fs.promises.readFile(path.join(dir, "package.json"), "utf-8")
      ) as PkgJson;
    await fn(pkgJson, dir);
  } finally {
    fs.promises.rm(dir, { recursive: true, force: true });
  }
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
