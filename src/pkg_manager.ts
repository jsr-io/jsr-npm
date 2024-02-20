import { InstallOptions } from "./commands";
import { JsrPackage, findProjectDir } from "./utils";
import { spawn } from "node:child_process";
import * as kl from "kolorist";

const exec = async (cmd: string, args: string[], cwd: string) => {
  console.log(kl.dim(`$ ${cmd} ${args.join(" ")}`));

  const cp = spawn(cmd, args, { stdio: "inherit" });

  return new Promise<void>((resolve) => {
    cp.on("exit", (code) => {
      if (code === 0) resolve();
      else process.exit(code ?? 1);
    });
  });
};

function modeToFlag(mode: InstallOptions["mode"]): string {
  return mode === "dev"
    ? "--save-dev "
    : mode === "optional"
    ? "--save-optional "
    : "";
}

function toPackageArgs(pkgs: JsrPackage[]): string[] {
  return pkgs.map(
    (pkg) => `@${pkg.scope}/${pkg.name}@npm:${pkg.toNpmPackage()}`
  );
}

export interface PackageManager {
  cwd: string;
  install(packages: JsrPackage[], options: InstallOptions): Promise<void>;
  remove(packages: JsrPackage[]): Promise<void>;
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

    await exec("npm", args, this.cwd);
  }

  async remove(packages: JsrPackage[]) {
    await exec(
      "npm",
      ["remove", ...packages.map((pkg) => pkg.toString())],
      this.cwd
    );
  }
}

class Yarn implements PackageManager {
  constructor(public cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const args = ["add"];
    const mode = modeToFlag(options.mode);
    if (mode !== "") {
      args.push(mode);
    }
    args.push(...toPackageArgs(packages));
    await exec("yarn", args, this.cwd);
  }

  async remove(packages: JsrPackage[]) {
    await exec(
      "yarn",
      ["remove", ...packages.map((pkg) => pkg.toString())],
      this.cwd
    );
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
    await exec("pnpm", args, this.cwd);
  }

  async remove(packages: JsrPackage[]) {
    await exec(
      "yarn",
      ["remove", ...packages.map((pkg) => pkg.toString())],
      this.cwd
    );
  }
}

export type PkgManagerName = "npm" | "yarn" | "pnpm";

export async function getPkgManager(
  cwd: string,
  pkgManagerName: PkgManagerName | null
) {
  const { projectDir, pkgManagerName: foundPkgManager } = await findProjectDir(
    cwd
  );

  const result = pkgManagerName || foundPkgManager || "npm";

  if (result === "yarn") {
    return new Yarn(projectDir);
  } else if (result === "pnpm") {
    return new Pnpm(projectDir);
  }

  return new Npm(projectDir);
}
