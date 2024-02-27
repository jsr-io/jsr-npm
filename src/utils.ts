import * as path from "node:path";
import * as fs from "node:fs";
import { PkgManagerName } from "./pkg_manager";
import { spawn } from "node:child_process";

export let DEBUG = false;
export function setDebug(enabled: boolean) {
  DEBUG = enabled;
}
export function logDebug(msg: string) {
  if (DEBUG) {
    console.log(msg);
  }
}

const EXTRACT_REG = /^@([a-z][a-z0-9-]+)\/([a-z0-9-]+)(@(.+))?$/;
const EXTRACT_REG_PROXY = /^@jsr\/([a-z][a-z0-9-]+)__([a-z0-9-]+)(@(.+))?$/;

export class JsrPackageNameError extends Error {}

export class JsrPackage {
  static from(input: string) {
    const exactMatch = input.match(EXTRACT_REG);
    if (exactMatch !== null) {
      const scope = exactMatch[1];
      const name = exactMatch[2];
      const version = exactMatch[4] ?? null;
      return new JsrPackage(scope, name, version);
    }

    const proxyMatch = input.match(EXTRACT_REG_PROXY);
    if (proxyMatch !== null) {
      const scope = proxyMatch[1];
      const name = proxyMatch[2];
      const version = proxyMatch[4] ?? null;
      return new JsrPackage(scope, name, version);
    }

    throw new JsrPackageNameError(
      `Invalid jsr package name: A jsr package name must have the format @<scope>/<name>, but got "${input}"`
    );
  }

  private constructor(
    public scope: string,
    public name: string,
    public version: string | null
  ) {}

  toNpmPackage(): string {
    const version = this.version !== null ? `@${this.version}` : "";
    return `@jsr/${this.scope}__${this.name}${version}`;
  }

  toString() {
    const version = this.version !== null ? `@${this.version}` : "";
    return `@${this.scope}/${this.name}${version}`;
  }
}

async function fileExists(file: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(file);
    return stat.isFile();
  } catch (err) {
    return false;
  }
}

export interface ProjectInfo {
  projectDir: string;
  pkgManagerName: PkgManagerName | null;
  pkgJsonPath: string | null;
}
export async function findProjectDir(
  cwd: string,
  dir: string = cwd,
  result: ProjectInfo = {
    projectDir: cwd,
    pkgManagerName: null,
    pkgJsonPath: null,
  }
): Promise<ProjectInfo> {
  const npmLockfile = path.join(dir, "package-lock.json");
  if (await fileExists(npmLockfile)) {
    logDebug(`Detected npm from lockfile ${npmLockfile}`);
    result.projectDir = dir;
    result.pkgManagerName = "npm";
    return result;
  }

  const yarnLockFile = path.join(dir, "yarn.lock");
  if (await fileExists(yarnLockFile)) {
    logDebug(`Detected yarn from lockfile ${yarnLockFile}`);
    result.projectDir = dir;
    result.pkgManagerName = "yarn";
    return result;
  }

  const pnpmLockfile = path.join(dir, "pnpm-lock.yaml");
  if (await fileExists(pnpmLockfile)) {
    logDebug(`Detected pnpm from lockfile ${pnpmLockfile}`);
    result.projectDir = dir;
    result.pkgManagerName = "pnpm";
    return result;
  }

  const bunLockfile = path.join(dir, "bun.lockb");
  if (await fileExists(bunLockfile)) {
    logDebug(`Detected bun from lockfile ${bunLockfile}`);
    result.projectDir = dir;
    result.pkgManagerName = "bun";
    return result;
  }

  const pkgJsonPath = path.join(dir, "package.json");
  if (await fileExists(pkgJsonPath)) {
    logDebug(`Found package.json at ${pkgJsonPath}`);
    result.projectDir = dir;
  }

  const prev = dir;
  dir = path.dirname(dir);
  if (dir === prev) {
    return result;
  }

  return findProjectDir(cwd, dir, result);
}

const PERIODS = {
  day: 24 * 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  minute: 60 * 1000,
  seconds: 1000,
};

export function prettyTime(diff: number) {
  if (diff > PERIODS.day) {
    return Math.floor(diff / PERIODS.day) + "d";
  } else if (diff > PERIODS.hour) {
    return Math.floor(diff / PERIODS.hour) + "h";
  } else if (diff > PERIODS.minute) {
    return Math.floor(diff / PERIODS.minute) + "m";
  } else if (diff > PERIODS.seconds) {
    return Math.floor(diff / PERIODS.seconds) + "s";
  }

  return diff + "ms";
}

export async function exec(
  cmd: string,
  args: string[],
  cwd: string,
  env?: Record<string, string | undefined>
) {
  const cp = spawn(cmd, args, { stdio: "inherit", cwd, shell: true, env });

  return new Promise<void>((resolve) => {
    cp.on("exit", (code) => {
      if (code === 0) resolve();
      else process.exit(code ?? 1);
    });
  });
}
