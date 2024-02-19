#!/usr/bin/env node
import * as kl from "kolorist";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { install, remove, setupNpmRc } from "./commands";
import { JsrPackage, findLockFile, setDebug } from "./utils";
import { detectPackageManager } from "./pkg_manager";

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
  ["r, uninstall, remove", "Remove one ore more jsr packages"],
])}

Options:
${prettyPrintRow([
  [
    "-P, --save-prod",
    "Package will be added to dependencies. This is the default.",
  ],
  ["-D, --save-dev", "Package will be added to devDependencies."],
  ["-O, --save-optional", "Package will be added to optionalDependencies."],
  ["--verbose", "Show additional debugging information."],
  ["-h, --help", "Show this help text."],
  ["--version", "Print the version number."],
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

  const cmd = options.positionals[0];
  if (cmd === "i" || cmd === "install" || cmd === "add") {
    (async () => {
      const packages = getPackages(options.positionals);
      await install(packages, {
        mode: options.values["save-dev"]
          ? "dev"
          : options.values["save-optional"]
          ? "optional"
          : "prod",
      });
    })();
  } else if (cmd === "r" || cmd === "uninstall" || cmd === "remove") {
    (async () => {
      const packages = getPackages(options.positionals);
      await remove(packages);
    })();
  } else {
    console.error(kl.red(`Unknown command: ${cmd}`));
    console.log();
    printHelp();
    process.exit(1);
  }
}
