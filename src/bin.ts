#!/usr/bin/env node
// Copyright 2024 the JSR authors. MIT license.
import * as kl from "kolorist";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { install, publish, remove } from "./commands";
import { JsrPackage, JsrPackageNameError, prettyTime, setDebug } from "./utils";
import { PkgManagerName } from "./pkg_manager";

const args = process.argv.slice(2);

function prettyPrintRow(rows: [string, string][]) {
  let max = 0;
  for (let i = 0; i < rows.length; i++) {
    const len = rows[i][0].length;
    max = len > max ? len : max;
  }

  return rows
    .map((row) => `  ${kl.green(row[0].padStart(max))}  ${row[1]}`)
    .join("\n");
}

function printHelp() {
  console.log(`jsr.io cli for node

Usage:
${prettyPrintRow([
  ["jsr add @std/log", 'Install the "@std/log" package from jsr.io'],
  ["jsr remove @std/log", 'Remove the "@std/log" package from the project'],
])}

Commands:
${prettyPrintRow([
  ["i, install, add", "Install one or more jsr packages"],
  ["r, uninstall, remove", "Remove one or more jsr packages"],
  ["publish", "Publish a package to the JSR registry."],
])}

Options:
${prettyPrintRow([
  [
    "-P, --save-prod",
    "Package will be added to dependencies. This is the default.",
  ],
  ["-D, --save-dev", "Package will be added to devDependencies."],
  ["-O, --save-optional", "Package will be added to optionalDependencies."],
  ["--npm", "Use npm to remove and install packages."],
  ["--yarn", "Use yarn to remove and install packages."],
  ["--pnpm", "Use pnpm to remove and install packages."],
  ["--bun", "Use bun to remove and install packages."],
  ["--verbose", "Show additional debugging information."],
  ["-h, --help", "Show this help text."],
  ["--version", "Print the version number."],
])}

Publish Options:
${prettyPrintRow([
  [
    "--token <Token>",
    "The API token to use when publishing. If unset, interactive authentication is be used.",
  ],
  [
    "--dry-run",
    "Prepare the package for publishing performing all checks and validations without uploading.",
  ],
  ["--allow-slow-types", "Allow publishing with slow types."],
])}

Environment variables:
${prettyPrintRow([
  ["JSR_URL", "Use a different registry url for the publish command"],
])}
`);
}

function getPackages(positionals: string[]): JsrPackage[] {
  const pkgArgs = positionals.slice(1);
  const packages = pkgArgs.map((p) => JsrPackage.from(p));

  if (pkgArgs.length === 0) {
    console.error(kl.red(`Missing packages argument.`));
    console.log();
    printHelp();
    process.exit(1);
  }

  return packages;
}

if (args.length === 0) {
  printHelp();
  process.exit(0);
} else {
  const options = parseArgs({
    args,
    allowPositionals: true,
    options: {
      "save-prod": { type: "boolean", default: true, short: "P" },
      "save-dev": { type: "boolean", default: false, short: "D" },
      "save-optional": { type: "boolean", default: false, short: "O" },
      "dry-run": { type: "boolean", default: false },
      "allow-slow-types": { type: "boolean", default: false },
      token: { type: "string" },
      npm: { type: "boolean", default: false },
      yarn: { type: "boolean", default: false },
      pnpm: { type: "boolean", default: false },
      bun: { type: "boolean", default: false },
      debug: { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false },
    },
  });

  if (options.values.debug || process.env.DEBUG) {
    setDebug(true);
  }

  if (options.values.help) {
    printHelp();
    process.exit(0);
  } else if (options.values.version) {
    const version = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
    ).version as string;
    console.log(version);
    process.exit(0);
  } else if (options.positionals.length === 0) {
    printHelp();
    process.exit(0);
  }

  const pkgManagerName: PkgManagerName | null = options.values.pnpm
    ? "pnpm"
    : options.values.yarn
    ? "yarn"
    : options.values.bun
    ? "bun"
    : null;

  const cmd = options.positionals[0];
  if (cmd === "i" || cmd === "install" || cmd === "add") {
    run(async () => {
      const packages = getPackages(options.positionals);
      await install(packages, {
        mode: options.values["save-dev"]
          ? "dev"
          : options.values["save-optional"]
          ? "optional"
          : "prod",
        pkgManagerName,
      });
    });
  } else if (cmd === "r" || cmd === "uninstall" || cmd === "remove") {
    run(async () => {
      const packages = getPackages(options.positionals);
      await remove(packages, { pkgManagerName });
    });
  } else if (cmd === "publish") {
    const binFolder = path.join(__dirname, "..", ".download");
    run(() =>
      publish(process.cwd(), {
        binFolder,
        dryRun: options.values["dry-run"] ?? false,
        allowSlowTypes: options.values["allow-slow-types"] ?? false,
        token: options.values.token,
      })
    );
  } else {
    console.error(kl.red(`Unknown command: ${cmd}`));
    console.log();
    printHelp();
    process.exit(1);
  }
}

async function run(fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const time = Date.now() - start;
    console.log();
    console.log(`${kl.green("Completed")} in ${prettyTime(time)}`);
  } catch (err) {
    if (err instanceof JsrPackageNameError) {
      console.log(kl.red(err.message));
      process.exit(1);
    }

    throw err;
  }
}
