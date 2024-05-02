// Copyright 2024 the JSR authors. MIT license.
import * as path from "node:path";
import * as fs from "node:fs";
import * as kl from "kolorist";
import {
  exec,
  fileExists,
  getNewLineChars,
  JsrPackage,
  timeAgo,
} from "./utils";
import { Bun, getPkgManager, PkgManagerName, YarnBerry } from "./pkg_manager";
import { downloadDeno, getDenoDownloadUrl } from "./download";
import { getNpmPackageInfo, getPackageMeta } from "./api";
import semiver from "semiver";

const NPMRC_FILE = ".npmrc";
const BUNFIG_FILE = "bunfig.toml";
const JSR_NPM_REGISTRY_URL = "https://npm.jsr.io";
const JSR_NPMRC = `@jsr:registry=${JSR_NPM_REGISTRY_URL}\n`;
const JSR_BUNFIG = `[install.scopes]\n"@jsr" = "${JSR_NPM_REGISTRY_URL}"\n`;
const JSR_YARN_BERRY_CONFIG_KEY = "npmScopes.jsr.npmRegistryServer";

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
    if (!content.includes("@jsr:registry=")) {
      const nl = getNewLineChars(content);
      const spacer = (!content.endsWith(nl)) ? nl : "";
      content += spacer + JSR_NPMRC;
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
    if (!/^"@jsr"\s+=/gm.test(content)) {
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
  const { pkgManager, root } = await getPkgManager(
    process.cwd(),
    options.pkgManagerName,
  );

  if (packages.length > 0) {
    if (pkgManager instanceof Bun) {
      // Bun doesn't support reading from .npmrc yet
      await setupBunfigToml(root);
    } else if (pkgManager instanceof YarnBerry) {
      // Yarn v2+ does not read from .npmrc intentionally
      // https://yarnpkg.com/migration/guide#update-your-configuration-to-the-new-settings
      await pkgManager.setConfigValue(
        JSR_YARN_BERRY_CONFIG_KEY,
        JSR_NPM_REGISTRY_URL,
      );
    } else {
      await setupNpmRc(root);
    }

    console.log(`Installing ${kl.cyan(packages.join(", "))}...`);
  }

  await pkgManager.install(packages, options);
}

export async function remove(packages: JsrPackage[], options: BaseOptions) {
  const { pkgManager } = await getPkgManager(
    process.cwd(),
    options.pkgManagerName,
  );
  console.log(`Removing ${kl.cyan(packages.join(", "))}...`);
  await pkgManager.remove(packages);
}

export interface PublishOptions {
  binFolder: string;
  pkgJsonPath: string | null;
  publishArgs: string[];
}

async function getOrDownloadBinPath(binFolder: string) {
  const info = await getDenoDownloadUrl();

  const binPath = path.join(
    binFolder,
    info.version,
    // Ensure each binary has their own folder to avoid overwriting it
    // in case jsr gets added to a project as a dependency where
    // developers use multiple OSes
    process.platform,
    process.platform === "win32" ? "deno.exe" : "deno",
  );

  // Check if deno executable is available, download it if not.
  if (!(await fileExists(binPath))) {
    // Clear folder first to get rid of old download artifacts
    // to avoid taking up lots of disk space.
    try {
      await fs.promises.rm(binFolder, { recursive: true });
    } catch (err) {
      if (!(err instanceof Error) || (err as any).code !== "ENOENT") {
        throw err;
      }
    }

    await downloadDeno(binPath, info);
  }

  return binPath;
}

export async function publish(cwd: string, options: PublishOptions) {
  const binPath = process.env.DENO_BIN_PATH ??
    await getOrDownloadBinPath(options.binFolder);

  // Ready to publish now!
  const args = [
    "publish",
  ];
  const env = { ...process.env };

  // These commands should only be added for a node project,
  // not a Deno project.
  if (options.pkgJsonPath !== null) {
    args.push(
      "--unstable-bare-node-builtins",
      "--unstable-sloppy-imports",
      "--unstable-byonm",
      "--no-check",
    );

    env.DENO_DISABLE_PEDANTIC_NODE_WARNINGS = "true";
  }

  args.push(...options.publishArgs.filter((arg) => arg !== "--verbose"));

  await exec(binPath, args, cwd, env);
}

export async function runScript(
  cwd: string,
  script: string,
  options: BaseOptions,
) {
  const { pkgManager } = await getPkgManager(cwd, options.pkgManagerName);
  await pkgManager.runScript(script);
}

export async function showPackageInfo(raw: string) {
  const pkg = JsrPackage.from(raw);

  const meta = await getPackageMeta(pkg);
  if (pkg.version === null) {
    let latest = meta.latest;
    if (latest === undefined) {
      throw new Error(`Missing latest version for ${pkg}`);
    } else if (latest === null) {
      // When no stable version is published: `latest === null`. We need to
      // manually find the latest pre-release version
      const versions = Object.keys(meta.versions);

      if (versions.length === 0) {
        throw new Error(`Could not find published version for ${pkg}`);
      }

      versions.sort(semiver);
      pkg.version = versions[0];
    } else {
      pkg.version = latest;
    }
  }

  const versionCount = Object.keys(meta.versions).length;

  const npmInfo = await getNpmPackageInfo(pkg);

  const versionInfo = npmInfo.versions[pkg.version]!;
  const time = npmInfo.time[pkg.version];

  const publishTime = new Date(time).getTime();

  console.log();
  console.log(
    kl.cyan(`@${pkg.scope}/${pkg.name}@${pkg.version}`) +
      ` | latest: ${kl.magenta(meta.latest ?? "-")} | versions: ${
        kl.magenta(versionCount)
      }`,
  );
  console.log(npmInfo.description);
  console.log();
  console.log(`npm tarball:   ${kl.cyan(versionInfo.dist.tarball)}`);
  console.log(`npm integrity: ${kl.cyan(versionInfo.dist.integrity)}`);
  console.log();
  console.log(
    `published: ${kl.magenta(timeAgo(Date.now() - publishTime))}`,
  );
}
