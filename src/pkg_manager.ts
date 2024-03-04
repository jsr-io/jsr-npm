// Copyright 2024 the JSR authors. MIT license.
import { InstallOptions } from "./commands";
import { exec, findProjectDir, JsrPackage, logDebug } from "./utils";
import * as kl from "kolorist";

const JSR_URL = "https://jsr.io";

async function execWithLog(cmd: string, args: string[], cwd: string) {
  console.log(kl.dim(`$ ${cmd} ${args.join(" ")}`));
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
  const version = await exec("yarn", ["--version"], cwd, undefined, true);
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

async function getLatestPackageVersion(pkg: JsrPackage) {
  const url = `${JSR_URL}/${pkg}/meta.json`;
  const res = await fetch(url);
  if (!res.ok) {
    // cancel the response body here in order to avoid a potential memory leak in node:
    // https://github.com/nodejs/undici/tree/c47e9e06d19cf61b2fa1fcbfb6be39a6e3133cab/docs#specification-compliance
    await res.body?.cancel();
    throw new Error(`Received ${res.status} from ${url}`);
  }
  const { latest } = await res.json();
  if (!latest) {
    throw new Error(`Unable to find latest version of ${pkg}`);
  }
  return latest;
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
      "yarn",
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
) {
  const envPkgManager = process.env.npm_config_user_agent;
  const fromEnv = envPkgManager !== undefined
    ? getPkgManagerFromEnv(envPkgManager)
    : null;

  const { projectDir, pkgManagerName: fromLockfile } = await findProjectDir(
    cwd,
  );

  const result = pkgManagerName || fromEnv || fromLockfile || "npm";

  if (result === "yarn") {
    return await isYarnBerry(projectDir)
      ? new YarnBerry(projectDir)
      : new Yarn(projectDir);
  } else if (result === "pnpm") {
    return new Pnpm(projectDir);
  } else if (result === "bun") {
    return new Bun(projectDir);
  }

  return new Npm(projectDir);
}
