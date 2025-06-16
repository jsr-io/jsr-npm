// Copyright 2024 the JSR authors. MIT license.
import { getLatestPackageVersion } from "./api";
import { InstallOptions } from "./commands";
import { exec, findProjectDir, JsrPackage, logDebug } from "./utils";
import { styleText } from './utils'
import semiver from "semiver";

async function execWithLog(cmd: string, args: string[], cwd: string) {
  console.log(styleText("dim", `$ ${cmd} ${args.join(" ")}`));
  return exec(cmd, args, cwd);
}

function modeToFlag(mode: InstallOptions["mode"]): string {
  return mode === "dev"
    ? "--save-dev"
    : mode === "optional"
    ? "--save-optional"
    : "";
}

function modeToFlagYarn(mode: InstallOptions["mode"]): string {
  return mode === "dev" ? "--dev" : mode === "optional" ? "--optional" : "";
}

function toPackageArgs(pkgs: JsrPackage[]): string[] {
  return pkgs.map(
    (pkg) => `@${pkg.scope}/${pkg.name}@npm:${pkg.toNpmPackage()}`,
  );
}

async function isYarnBerry(cwd: string) {
  // this command works for both yarn classic and berry
  const output = await exec("yarn", ["--version"], cwd, undefined, true);
  const version = output.stdout;
  if (!version) {
    logDebug("Unable to detect yarn version, assuming classic");
    return false;
  }
  if (version.startsWith("1.")) {
    logDebug("Detected yarn classic from version");
    return false;
  }
  logDebug("Detected yarn berry from version");
  return true;
}

export interface PackageManager {
  cwd: string;
  install(packages: JsrPackage[], options: InstallOptions): Promise<void>;
  remove(packages: JsrPackage[]): Promise<void>;
  runScript(script: string): Promise<void>;
  setConfigValue?(key: string, value: string): Promise<void>;
}

class Npm implements PackageManager {
  constructor(public cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const args = ["install"];
    const mode = modeToFlag(options.mode);
    if (mode !== "") {
      args.push(mode);
    }
    args.push(...toPackageArgs(packages));

    await execWithLog("npm", args, this.cwd);
  }

  async remove(packages: JsrPackage[]) {
    await execWithLog(
      "npm",
      ["remove", ...packages.map((pkg) => pkg.toString())],
      this.cwd,
    );
  }

  async runScript(script: string) {
    await execWithLog("npm", ["run", script], this.cwd);
  }
}

class Yarn implements PackageManager {
  constructor(public cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const args = ["add"];
    const mode = modeToFlagYarn(options.mode);
    if (mode !== "") {
      args.push(mode);
    }
    args.push(...toPackageArgs(packages));
    await execWithLog("yarn", args, this.cwd);
  }

  async remove(packages: JsrPackage[]) {
    await execWithLog(
      "yarn",
      ["remove", ...packages.map((pkg) => pkg.toString())],
      this.cwd,
    );
  }

  async runScript(script: string) {
    await execWithLog("yarn", [script], this.cwd);
  }
}

export class YarnBerry extends Yarn {
  async install(packages: JsrPackage[], options: InstallOptions) {
    const args = ["add"];
    const mode = modeToFlagYarn(options.mode);
    if (mode !== "") {
      args.push(mode);
    }
    args.push(...(await this.toPackageArgs(packages)));
    await execWithLog("yarn", args, this.cwd);
  }

  /**
   * Calls the `yarn config set` command, https://yarnpkg.com/cli/config/set.
   */
  async setConfigValue(key: string, value: string) {
    await execWithLog("yarn", ["config", "set", key, value], this.cwd);
  }

  private async toPackageArgs(pkgs: JsrPackage[]) {
    // nasty workaround for https://github.com/yarnpkg/berry/issues/1816
    await Promise.all(pkgs.map(async (pkg) => {
      pkg.version ??= `^${await getLatestPackageVersion(pkg)}`;
    }));
    return toPackageArgs(pkgs);
  }
}

class Pnpm implements PackageManager {
  constructor(public cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const args = ["add"];
    const mode = modeToFlag(options.mode);
    if (mode !== "") {
      args.push(mode);
    }
    args.push(...toPackageArgs(packages));
    await execWithLog("pnpm", args, this.cwd);
  }

  async remove(packages: JsrPackage[]) {
    await execWithLog(
      "pnpm",
      ["remove", ...packages.map((pkg) => pkg.toString())],
      this.cwd,
    );
  }

  async runScript(script: string) {
    await execWithLog("pnpm", [script], this.cwd);
  }
}

export class Bun implements PackageManager {
  constructor(public cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const args = ["add"];
    const mode = modeToFlagYarn(options.mode);
    if (mode !== "") {
      args.push(mode);
    }
    args.push(...toPackageArgs(packages));
    await execWithLog("bun", args, this.cwd);
  }

  async remove(packages: JsrPackage[]) {
    await execWithLog(
      "bun",
      ["remove", ...packages.map((pkg) => pkg.toString())],
      this.cwd,
    );
  }

  async runScript(script: string) {
    await execWithLog("bun", ["run", script], this.cwd);
  }

  async isNpmrcSupported() {
    const output = await exec("bun", ["--version"], this.cwd, undefined, true);
    const version = output.stdout;
    // bun v1.1.18 supports npmrc https://bun.sh/blog/bun-v1.1.18#npmrc-support
    return version != null && semiver(version, "1.1.18") >= 0;
  }
}

export type PkgManagerName = "npm" | "yarn" | "pnpm" | "bun";

function getPkgManagerFromEnv(value: string): PkgManagerName | null {
  if (value.startsWith("pnpm/")) return "pnpm";
  else if (value.startsWith("yarn/")) return "yarn";
  else if (value.startsWith("npm/")) return "npm";
  else if (value.startsWith("bun/")) return "bun";
  else return null;
}

export async function getPkgManager(
  cwd: string,
  pkgManagerName: PkgManagerName | null,
): Promise<{ root: string; pkgManager: PackageManager }> {
  const envPkgManager = process.env.npm_config_user_agent;
  const fromEnv = envPkgManager !== undefined
    ? getPkgManagerFromEnv(envPkgManager)
    : null;

  const { projectDir, pkgManagerName: fromLockfile, root } =
    await findProjectDir(
      cwd,
    );
  const rootPath = root || projectDir;

  const result = pkgManagerName || fromLockfile || fromEnv || "npm";

  let pkgManager: PackageManager;
  if (result === "yarn") {
    pkgManager = await isYarnBerry(projectDir)
      ? new YarnBerry(projectDir)
      : new Yarn(projectDir);
  } else if (result === "pnpm") {
    pkgManager = new Pnpm(projectDir);
  } else if (result === "bun") {
    pkgManager = new Bun(projectDir);
  } else {
    pkgManager = new Npm(projectDir);
  }

  return { root: rootPath, pkgManager };
}
