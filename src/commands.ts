import * as path from "node:path";
import * as fs from "node:fs";
import { JsrPackage, findLockFile } from "./utils";
import { detectPackageManager } from "./pkg_manager";

const JSR_NPMRC = `@jsr:registry=https://npm.jsr.io\n`;

export async function setupNpmRc(dir: string) {
  const npmRcPath = path.join(dir, ".npmrc");
  try {
    let content = await fs.promises.readFile(npmRcPath, "utf-8");
    if (!content.includes(JSR_NPMRC)) {
      content += JSR_NPMRC;
      await fs.promises.writeFile(npmRcPath, content);
    }
  } catch (err) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      await fs.promises.writeFile(npmRcPath, JSR_NPMRC);
    } else {
      throw err;
    }
  }
}

export interface InstallOptions {
  mode: "dev" | "prod" | "optional";
}

export async function install(packages: JsrPackage[], options: InstallOptions) {
  const lockFilePath = await findLockFile(process.cwd());
  const projectDir = path.dirname(lockFilePath);
  await setupNpmRc(projectDir);

  const pkgManager = await detectPackageManager(lockFilePath);
  await pkgManager.install(packages, options);
}

export async function remove(packages: JsrPackage[]) {
  const lockFilePath = await findLockFile(process.cwd());
  const pkgManager = await detectPackageManager(lockFilePath);
  await pkgManager.remove(packages);
}
