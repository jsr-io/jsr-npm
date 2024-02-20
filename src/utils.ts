import * as path from "node:path";
import * as fs from "node:fs";

export let DEBUG = false;
export function setDebug(enabled: boolean) {
  DEBUG = enabled;
}
export function logDebug(msg: string) {
  if (DEBUG) {
    console.log(msg);
  }
}

const EXTRACT_REG = /^@([a-z][a-z0-9-]+)\/([a-z0-9-]+)$/;
const EXTRACT_REG_PROXY = /^@jsr\/([a-z][a-z0-9-]+)__([a-z0-9-]+)$/;

export class JsrPackage {
  static from(input: string) {
    const exactMatch = input.match(EXTRACT_REG);
    if (exactMatch !== null) {
      const scope = exactMatch[1];
      const name = exactMatch[2];
      return new JsrPackage(scope, name);
    }

    const proxyMatch = input.match(EXTRACT_REG_PROXY);
    if (proxyMatch !== null) {
      const scope = proxyMatch[1];
      const name = proxyMatch[2];
      return new JsrPackage(scope, name);
    }

    throw new Error(`Invalid jsr package name: ${input}`);
  }

  private constructor(public scope: string, public name: string) {}

  toNpmPackage(): string {
    return `@jsr/${this.scope}__${this.name}`;
  }

  toString() {
    return `@${this.scope}/${this.name}`;
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

export async function findLockFile(dir: string): Promise<string> {
  const npmLockfile = path.join(dir, "package-lock.json");
  if (await fileExists(npmLockfile)) {
    logDebug("Using npm package manager");
    return npmLockfile;
  }

  const yarnLockFile = path.join(dir, "yarn.lock");
  if (await fileExists(yarnLockFile)) {
    logDebug("Using yarn package manager");
    return yarnLockFile;
  }

  const pnpmLockfile = path.join(dir, "pnpm-lock.yaml");
  if (await fileExists(pnpmLockfile)) {
    logDebug("Using pnpm package manager");
    return pnpmLockfile;
  }

  const prev = dir;
  dir = path.dirname(dir);
  if (dir === prev) {
    throw new Error(`Could not find lockfile.`);
  }

  return findLockFile(dir);
}
