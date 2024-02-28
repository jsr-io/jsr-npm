// Copyright 2024 the JSR authors. MIT license.
import { InstallOptions } from './commands';
import { exec, findProjectDir, JsrPackage } from './utils';
import * as kl from 'kolorist';

async function execWithLog(cmd: string, args: string[], cwd: string) {
  console.log(kl.dim(`$ ${cmd} ${args.join(' ')}`));
  return exec(cmd, args, cwd);
}

function modeToFlag(mode: InstallOptions['mode']): string {
  return mode === 'dev'
    ? '--save-dev'
    : mode === 'optional'
    ? '--save-optional'
    : '';
}

function toPackageArgs(pkgs: JsrPackage[]): string[] {
  return pkgs.map(
    (pkg) => `@${pkg.scope}/${pkg.name}@npm:${pkg.toNpmPackage()}`,
  );
}

export interface PackageManager {
  cwd: string;
  install(packages: JsrPackage[], options: InstallOptions): Promise<void>;
  remove(packages: JsrPackage[]): Promise<void>;
  runScript(script: string): Promise<void>;
}

class Npm implements PackageManager {
  constructor(public cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const args = ['install'];
    const mode = modeToFlag(options.mode);
    if (mode !== '') {
      args.push(mode);
    }
    args.push(...toPackageArgs(packages));

    await execWithLog('npm', args, this.cwd);
  }

  async remove(packages: JsrPackage[]) {
    await execWithLog(
      'npm',
      ['remove', ...packages.map((pkg) => pkg.toString())],
      this.cwd,
    );
  }

  async runScript(script: string) {
    await execWithLog('npm', ['run', script], this.cwd);
  }
}

class Yarn implements PackageManager {
  constructor(public cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const args = ['add'];
    const mode = modeToFlag(options.mode);
    if (mode !== '') {
      args.push(mode);
    }
    args.push(...toPackageArgs(packages));
    await execWithLog('yarn', args, this.cwd);
  }

  async remove(packages: JsrPackage[]) {
    await execWithLog(
      'yarn',
      ['remove', ...packages.map((pkg) => pkg.toString())],
      this.cwd,
    );
  }

  async runScript(script: string) {
    await execWithLog('yarn', [script], this.cwd);
  }
}

class Pnpm implements PackageManager {
  constructor(public cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const args = ['add'];
    const mode = modeToFlag(options.mode);
    if (mode !== '') {
      args.push(mode);
    }
    args.push(...toPackageArgs(packages));
    await execWithLog('pnpm', args, this.cwd);
  }

  async remove(packages: JsrPackage[]) {
    await execWithLog(
      'yarn',
      ['remove', ...packages.map((pkg) => pkg.toString())],
      this.cwd,
    );
  }

  async runScript(script: string) {
    await execWithLog('pnpm', [script], this.cwd);
  }
}

export class Bun implements PackageManager {
  constructor(public cwd: string) {}

  async install(packages: JsrPackage[], options: InstallOptions) {
    const args = ['add'];
    const mode = modeToFlag(options.mode);
    if (mode !== '') {
      args.push(mode);
    }
    args.push(...toPackageArgs(packages));
    await execWithLog('bun', args, this.cwd);
  }

  async remove(packages: JsrPackage[]) {
    await execWithLog(
      'bun',
      ['remove', ...packages.map((pkg) => pkg.toString())],
      this.cwd,
    );
  }

  async runScript(script: string) {
    await execWithLog('bun', ['run', script], this.cwd);
  }
}

export type PkgManagerName = 'npm' | 'yarn' | 'pnpm' | 'bun';

function getPkgManagerFromEnv(value: string): PkgManagerName | null {
  if (value.startsWith('pnpm/')) return 'pnpm';
  else if (value.startsWith('yarn/')) return 'yarn';
  else if (value.startsWith('npm/')) return 'npm';
  else if (value.startsWith('bun/')) return 'bun';
  else return null;
}

export async function getPkgManager(
  cwd: string,
  pkgManagerName: PkgManagerName | null,
) {
  const envPkgManager = process.env.npm_config_user_agent;
  const fromEnv =
    envPkgManager !== undefined ? getPkgManagerFromEnv(envPkgManager) : null;

  const { projectDir, pkgManagerName: fromLockfile } = await findProjectDir(
    cwd,
  );

  const result = pkgManagerName || fromEnv || fromLockfile || 'npm';

  if (result === 'yarn') {
    return new Yarn(projectDir);
  } else if (result === 'pnpm') {
    return new Pnpm(projectDir);
  } else if (result === 'bun') {
    return new Bun(projectDir);
  }

  return new Npm(projectDir);
}
