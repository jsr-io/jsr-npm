import { promisify } from "node:util";
import * as path from "node:path";
import { InstallOptions } from "./commands";
import { JsrPackage, logDebug } from "./utils";
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

export function detectPackageManager(lockfilePath: string): PackageManager {
  const filename = path.basename(lockfilePath);
  const cwd = path.dirname(lockfilePath);

  if (filename === "package-lock.json") {
    return new Npm(cwd);
  } else if (filename === "yarn.lock") {
    return new Yarn(cwd);
  } else if (filename === "pnpm-lock.yml") {
    return new Pnpm(cwd);
  }

  throw new Error("Could not determine package manager");
}
