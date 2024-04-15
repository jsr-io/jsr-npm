// Copyright 2024 the JSR authors. MIT license.
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
      `Invalid jsr package name: A jsr package name must have the format @<scope>/<name>, but got "${input}"`,
    );
  }

  private constructor(
    public scope: string,
    public name: string,
    public version: string | null,
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

export async function fileExists(file: string): Promise<boolean> {
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
  root: string | null;
}
export async function findProjectDir(
  cwd: string,
  dir: string = cwd,
  result: ProjectInfo = {
    projectDir: cwd,
    pkgManagerName: null,
    pkgJsonPath: null,
    root: null,
  },
): Promise<ProjectInfo> {
  // Ensure we check for `package.json` first as this defines
  // the root project location.
  if (result.pkgJsonPath === null) {
    const pkgJsonPath = path.join(dir, "package.json");
    if (await fileExists(pkgJsonPath)) {
      logDebug(`Found package.json at ${pkgJsonPath}`);
      logDebug(`Setting project directory to ${dir}`);
      result.projectDir = dir;
      result.pkgJsonPath = pkgJsonPath;
    }
  } else {
    const pkgJsonPath = path.join(dir, "package.json");
    if (await fileExists(pkgJsonPath)) {
      const json = await readJson<PkgJson>(pkgJsonPath);
      // npm + yarn + bun workspaces
      if (Array.isArray(json.workspaces)) {
        result.root = dir;
      } // pnpm workspaces
      else if (await fileExists(path.join(dir, "pnpm-workspace.yaml"))) {
        result.root = dir;
      }
    }
  }

  const npmLockfile = path.join(dir, "package-lock.json");
  if (await fileExists(npmLockfile)) {
    logDebug(`Detected npm from lockfile ${npmLockfile}`);
    result.pkgManagerName = "npm";
    return result;
  }

  // prefer bun.lockb over yarn.lock
  // In some cases, both bun.lockb and yarn.lock can exist in the same project.
  // https://bun.sh/docs/install/lockfile
  const bunLockfile = path.join(dir, "bun.lockb");
  if (await fileExists(bunLockfile)) {
    logDebug(`Detected bun from lockfile ${bunLockfile}`);
    result.pkgManagerName = "bun";
    return result;
  }

  const yarnLockFile = path.join(dir, "yarn.lock");
  if (await fileExists(yarnLockFile)) {
    logDebug(`Detected yarn from lockfile ${yarnLockFile}`);
    result.pkgManagerName = "yarn";
    return result;
  }

  const pnpmLockfile = path.join(dir, "pnpm-lock.yaml");
  if (await fileExists(pnpmLockfile)) {
    logDebug(`Detected pnpm from lockfile ${pnpmLockfile}`);
    result.pkgManagerName = "pnpm";
    return result;
  }

  const prev = dir;
  dir = path.dirname(dir);
  if (dir === prev) {
    return result;
  }

  return findProjectDir(cwd, dir, result);
}

const PERIODS = {
  year: 365 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
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

export function timeAgo(diff: number) {
  if (diff > PERIODS.year) {
    const v = Math.floor(diff / PERIODS.year);
    return `${v} year${v > 1 ? "s" : ""} ago`;
  } else if (diff > PERIODS.month) {
    const v = Math.floor(diff / PERIODS.month);
    return `${v} month${v > 1 ? "s" : ""} ago`;
  } else if (diff > PERIODS.week) {
    const v = Math.floor(diff / PERIODS.week);
    return `${v} week${v > 1 ? "s" : ""} ago`;
  } else if (diff > PERIODS.day) {
    const v = Math.floor(diff / PERIODS.day);
    return `${v} day${v > 1 ? "s" : ""} ago`;
  } else if (diff > PERIODS.hour) {
    const v = Math.floor(diff / PERIODS.hour);
    return `${v} hour${v > 1 ? "s" : ""} ago`;
  } else if (diff > PERIODS.minute) {
    const v = Math.floor(diff / PERIODS.minute);
    return `${v} minute${v > 1 ? "s" : ""} ago`;
  } else if (diff > PERIODS.seconds) {
    const v = Math.floor(diff / PERIODS.seconds);
    return `${v} second${v > 1 ? "s" : ""} ago`;
  }

  return "just now";
}

export class ExecError extends Error {
  constructor(public code: number) {
    super(`Child process exited with: ${code}`);
  }
}

export async function exec(
  cmd: string,
  args: string[],
  cwd: string,
  env?: Record<string, string | undefined>,
  captureOutput?: boolean,
) {
  const cp = spawn(
    cmd,
    args.map((arg) => process.platform === "win32" ? `"${arg}"` : `'${arg}'`),
    {
      stdio: captureOutput ? "pipe" : "inherit",
      cwd,
      shell: true,
      env,
    },
  );

  let output = "";

  if (captureOutput) {
    cp.stdout?.on("data", (data) => {
      output += data;
    });
    cp.stderr?.on("data", (data) => {
      output += data;
    });
  }

  return new Promise<string>((resolve, reject) => {
    cp.on("exit", (code) => {
      if (code === 0) resolve(output);
      else reject(new ExecError(code ?? 1));
    });
  });
}

export function getNewLineChars(source: string) {
  var temp = source.indexOf("\n");
  if (source[temp - 1] === "\r") {
    return "\r\n";
  }
  return "\n";
}

export async function readJson<T>(file: string): Promise<T> {
  const content = await fs.promises.readFile(file, "utf-8");
  return JSON.parse(content);
}

export interface PkgJson {
  name?: string;
  version?: string;
  license?: string;
  workspaces?: string[];

  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  exports?: string | Record<string, string | Record<string, string>>;
  scripts?: Record<string, string>;
}

export async function writeJson<T>(file: string, data: T): Promise<void> {
  try {
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
  } catch (_) {}
  await fs.promises.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export async function readTextFile(file: string): Promise<string> {
  return fs.promises.readFile(file, "utf-8");
}
export async function writeTextFile(
  file: string,
  content: string,
): Promise<void> {
  try {
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
  } catch (_) {}
  await fs.promises.writeFile(file, content, "utf-8");
}
