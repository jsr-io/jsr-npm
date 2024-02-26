import * as path from "node:path";
import * as fs from "node:fs";
import * as kl from "kolorist";
import { JsrPackage } from "./utils";
import { Bun, PkgManagerName, getPkgManager } from "./pkg_manager";

const NPMRC_FILE = ".npmrc";
const BUNFIG_FILE = "bunfig.toml";
const JSR_NPMRC = `@jsr:registry=https://npm.jsr.io\n`;
const JSR_BUNFIG = `[install.scopes]\n"@jsr" = "https://npm.jsr.io/"\n`;

async function wrapWithStatus(msg: string, fn: () => Promise<void>) {
  process.stdout.write(msg + "...");

  try {
    await fn();
    process.stdout.write(kl.green("ok") + "\n");
  } catch (err) {
    process.stdout.write(kl.red("error") + "\n");
    throw err;
  }
}

export async function setupNpmRc(dir: string) {
  const npmRcPath = path.join(dir, NPMRC_FILE);
  const msg = `Setting up ${NPMRC_FILE}`;
  try {
    let content = await fs.promises.readFile(npmRcPath, "utf-8");
    if (!content.includes(JSR_NPMRC)) {
      content += JSR_NPMRC;
      await wrapWithStatus(msg, async () => {
        await fs.promises.writeFile(npmRcPath, content);
      });
    }
  } catch (err) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      await wrapWithStatus(msg, async () => {
        await fs.promises.writeFile(npmRcPath, JSR_NPMRC);
      });
    } else {
      throw err;
    }
  }
}

export async function setupBunfigToml(dir: string) {
  const bunfigPath = path.join(dir, BUNFIG_FILE);
  const msg = `Setting up ${BUNFIG_FILE}`;
  try {
    let content = await fs.promises.readFile(bunfigPath, "utf-8");
    if (!/^"@myorg1"\s+=/gm.test(content)) {
      content += JSR_BUNFIG;
      await wrapWithStatus(msg, async () => {
        await fs.promises.writeFile(bunfigPath, content);
      });
    }
  } catch (err) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      await wrapWithStatus(msg, async () => {
        await fs.promises.writeFile(bunfigPath, JSR_BUNFIG);
      });
    } else {
      throw err;
    }
  }
}

export interface BaseOptions {
  pkgManagerName: PkgManagerName | null;
}

export interface InstallOptions extends BaseOptions {
  mode: "dev" | "prod" | "optional";
}

export async function install(packages: JsrPackage[], options: InstallOptions) {
  const pkgManager = await getPkgManager(process.cwd(), options.pkgManagerName);

  if (pkgManager instanceof Bun) {
    // Bun doesn't support reading from .npmrc yet
    await setupBunfigToml(pkgManager.cwd);
  } else {
    await setupNpmRc(pkgManager.cwd);
  }

  console.log(`Installing ${kl.cyan(packages.join(", "))}...`);
  await pkgManager.install(packages, options);
}

export async function remove(packages: JsrPackage[], options: BaseOptions) {
  const pkgManager = await getPkgManager(process.cwd(), options.pkgManagerName);
  console.log(`Removing ${kl.cyan(packages.join(", "))}...`);
  await pkgManager.remove(packages);
}

async function createFiles(cwd: string, files: Record<string, string>) {
  await Promise.all(
    Array.from(Object.entries(files)).map(([file, content]) => {
      const filePath = path.join(cwd, file);
      return fs.promises.writeFile(filePath, content, "utf-8");
    })
  );
}

export async function init(cwd: string) {
  await setupNpmRc(cwd);

  await createFiles(cwd, {
    "package.json": JSON.stringify(
      {
        name: "@<scope>/<package_name>",
        version: "0.0.1",
        description: "",
        license: "ISC",
        type: "module",
      },
      null,
      2
    ),
    // TODO: Rename to jsr.json, once supported in Deno
    // deno.json
    "deno.json": JSON.stringify(
      {
        name: "@<scope>/<package_name>",
        version: "0.0.1",
        description: "",
        exports: {
          ".": "./mod.ts",
        },
      },
      null,
      2
    ),
    "mod.ts": [
      "export function add(a: number, b: number): number {",
      "  return a + b;",
      "}",
    ].join("\n"),
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          moduleResolution: "NodeNext",
        },
      },
      null,
      2
    ),
  });
}
