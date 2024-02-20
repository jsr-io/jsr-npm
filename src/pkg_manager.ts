import { promisify } from "node:util";
import * as path from "node:path";
import { InstallOptions } from "./commands";
import { JsrPackage, findLockFile, findPackageJson, logDebug } from "./utils";
import * as cp from "node:child_process";

const execAsync = promisify(cp.exec);
const exec = (cmd: string, options: cp.ExecOptions) => {
  logDebug(`$ ${cmd}`);
  return execAsync(cmd, options);
};

function modeToFlag(mode: InstallOptions["mode"]): string {
  return mode === "dev"
    ? "--save-dev "
    : mode === "optional"
    ? "--save-optional "
    : "";
}

function toPackageArgs(pkgs: JsrPackage[]): string {
  return pkgs
    .map((pkg) => `@${pkg.scope}/${pkg.name}@npm:${pkg.toNpmPackage()}`)
    .join(" ");
}

function toMappedArg(pkgs: JsrPackage[]): string {
  return pkgs.map((pkg) => pkg.toString()).join(" ");
}

export interface PackageManager {
  install(packages: JsrPackage[], options: InstallOptions): Promise<void>;
  remove(packages: JsrPackage[]): Promise<void>;
}

class Npm implements PackageManager {
  constructor(private cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const mode = modeToFlag(options.mode);
    await exec(`npm install ${mode}${toPackageArgs(packages)}`, {
      cwd: this.cwd,
    });
  }

  async remove(packages: JsrPackage[]) {
    await exec(`npm remove ${toMappedArg(packages)}`, {
      cwd: this.cwd,
    });
  }
}

class Yarn implements PackageManager {
  constructor(private cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const mode = modeToFlag(options.mode);
    await exec(`yarn add ${mode}${toPackageArgs(packages)}`, {
      cwd: this.cwd,
    });
  }

  async remove(packages: JsrPackage[]) {
    await exec(`yarn remove ${toMappedArg(packages)}`, {
      cwd: this.cwd,
    });
  }
}

class Pnpm implements PackageManager {
  constructor(private cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const mode = modeToFlag(options.mode);
    await exec(`pnpm add ${mode}${toPackageArgs(packages)}`, {
      cwd: this.cwd,
    });
  }

  async remove(packages: JsrPackage[]) {
    cp.execSync(`pnpm remove ${toMappedArg(packages)}`, {
      cwd: this.cwd,
    });
  }
}

export async function getProjectDir(cwd: string): Promise<{
  projectDir: string;
  lockFilePath: string | null;
}> {
  const lockFilePath = await findLockFile(cwd);
  if (lockFilePath !== null) {
    const projectDir = path.dirname(lockFilePath);
    return { lockFilePath, projectDir };
  }

  const pkgJsonPath = await findPackageJson(cwd);
  if (pkgJsonPath !== null) {
    const projectDir = path.dirname(pkgJsonPath);
    return { lockFilePath: null, projectDir };
  }

  return { lockFilePath: null, projectDir: cwd };
}

export function detectPackageManager(
  lockFilePath: string | null,
  projectDir: string
): PackageManager {
  if (lockFilePath !== null) {
    const filename = path.basename(lockFilePath);
    if (filename === "package-lock.json") {
      return new Npm(projectDir);
    } else if (filename === "yarn.lock") {
      return new Yarn(projectDir);
    } else if (filename === "pnpm-lock.yml") {
      return new Pnpm(projectDir);
    }
  }

  // Fall back to npm if no lockfile is present.
  return new Npm(projectDir);
}
