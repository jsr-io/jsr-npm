import * as path from "node:path";
import * as fs from "node:fs";
import * as kl from "kolorist";
import { JsrPackage } from "./utils";
import { getPkgManager } from "./pkg_manager";

const JSR_NPMRC = `@jsr:registry=https://npm.jsr.io\n`;

export async function setupNpmRc(dir: string) {
  const npmRcPath = path.join(dir, ".npmrc");
  try {
    let content = await fs.promises.readFile(npmRcPath, "utf-8");
    if (!content.includes(JSR_NPMRC)) {
      content += JSR_NPMRC;
      await fs.promises.writeFile(npmRcPath, content);
    }
  } catch (err) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      await fs.promises.writeFile(npmRcPath, JSR_NPMRC);
    } else {
      throw err;
    }
  }
}

export interface BaseOptions {
  pkgManagerName: "npm" | "yarn" | "pnpm" | null;
}

export interface InstallOptions extends BaseOptions {
  mode: "dev" | "prod" | "optional";
}

export async function install(packages: JsrPackage[], options: InstallOptions) {
  console.log(`Installing ${kl.cyan(packages.join(", "))}...`);
  const pkgManager = await getPkgManager(process.cwd(), options.pkgManagerName);
  await setupNpmRc(pkgManager.cwd);

  await pkgManager.install(packages, options);
}

export async function remove(packages: JsrPackage[], options: BaseOptions) {
  console.log(`Removing ${kl.cyan(packages.join(", "))}...`);
  const pkgManager = await getPkgManager(process.cwd(), options.pkgManagerName);
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
