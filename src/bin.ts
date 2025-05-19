#!/usr/bin/env node
// Copyright 2024 the JSR authors. MIT license.
import * as kl from "kolorist";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import {
  install,
  publish,
  remove,
  runScript,
  showPackageInfo,
} from "./commands";
import {
  ExecError,
  findProjectDir,
  JsrPackage,
  JsrPackageNameError,
  prettyTime,
  setDebug,
} from "./utils";
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
${
    prettyPrintRow([
      ["jsr add @std/log", 'Install the "@std/log" package from jsr.io.'],
      [
        "jsr remove @std/log",
        'Remove the "@std/log" package from the project.',
      ],
    ])
  }

Commands:
${
    prettyPrintRow([
      ["<script>", "Run a script from the package.json file"],
      ["run <script>", "Run a script from the package.json file"],
      ["i, install, add", "Install one or more JSR packages."],
      ["r, uninstall, remove", "Remove one or more JSR packages."],
      ["publish", "Publish a package to the JSR registry."],
      ["info, show, view", "Show package information."],
    ])
  }

Options:
${
    prettyPrintRow([
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
      ["-v, --version", "Print the version number."],
    ])
  }

Publish Options:
${
    prettyPrintRow([
      [
        "--allow-dirty",
        "Allow publishing if the repository has uncommitted changed.",
      ],
      ["--allow-slow-types", "Allow publishing with slow types."],
      [
        "--dry-run",
        "Prepare the package for publishing performing all checks and validations without uploading.",
      ],
      [
        "--no-provenance",
        "Disable provenance attestation. Enabled by default on Github actions, publicly links the package to where it was built and published from.",
      ],
      [
        "--set-version <VERSION>",
        "Set version for a package to be published. This flag can be used while publishing individual packages and cannot be used in a workspace",
      ],
      [
        "--token <Token>",
        "The API token to use when publishing. If unset, interactive authentication will be used.",
      ],
    ])
  }

Environment variables:
${
    prettyPrintRow([
      ["JSR_URL", "Use a different registry URL for the publish command."],
      [
        "DENO_BIN_PATH",
        "Use specified Deno binary instead of local downloaded one.",
      ],
      [
        "DENO_BIN_CANARY",
        "Use the canary Deno binary instead of latest for publishing.",
      ],
    ])
  }
`);
}

function getPackages(positionals: string[], allowEmpty: boolean): JsrPackage[] {
  const pkgArgs = positionals.slice(1);
  const packages = pkgArgs.map((p) => JsrPackage.from(p));

  if (!allowEmpty && pkgArgs.length === 0) {
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
} else if (args.some((arg) => arg === "-h" || arg === "--help")) {
  printHelp();
  process.exit(0);
} else if (args.some((arg) => arg === "-v" || arg === "--version")) {
  const version = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"),
  ).version as string;
  console.log(version);
  process.exit(0);
} else {
  const cmd = args[0];
  // Bypass cli argument validation for publish command. The underlying
  // `deno publish` cli is under active development and args may change
  // frequently.
  if (cmd === "publish") {
    const binFolder = path.join(__dirname, "..", ".download");
    run(async () => {
      const projectInfo = await findProjectDir(process.cwd());
      return publish(process.cwd(), {
        canary: process.env.DENO_BIN_CANARY !== undefined,
        binFolder,
        publishArgs: args.slice(1),
        pkgJsonPath: projectInfo.pkgJsonPath,
      });
    });
  } else if (cmd === "view" || cmd === "show" || cmd === "info") {
    const pkgName = args[1];
    if (pkgName === undefined) {
      console.log(kl.red(`Missing package name.`));
      printHelp();
      process.exit(1);
    }

    run(async () => {
      await showPackageInfo(pkgName);
    });
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
        config: { type: "string", short: "c" },
        "no-config": { type: "boolean" },
        check: { type: "string" },
        "no-check": { type: "string" },
        quiet: { type: "boolean", short: "q" },
        npm: { type: "boolean", default: false },
        yarn: { type: "boolean", default: false },
        pnpm: { type: "boolean", default: false },
        bun: { type: "boolean", default: false },
        debug: { type: "boolean", default: false },
        canary: { type: "boolean", default: false },
        help: { type: "boolean", default: false, short: "h" },
        version: { type: "boolean", default: false, short: "v" },
      },
    });

    if (options.values.debug || process.env.DEBUG) {
      setDebug(true);
    }

    if (options.positionals.length === 0) {
      printHelp();
      process.exit(0);
    }

    const pkgManagerName: PkgManagerName | null = options.values.pnpm
      ? "pnpm"
      : options.values.yarn
      ? "yarn"
      : options.values.bun
      ? "bun"
      : options.values.npm
      ? "npm"
      : null;

    if (cmd === "i" || cmd === "install" || cmd === "add") {
      run(async () => {
        const packages = getPackages(options.positionals, true);

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
        const packages = getPackages(options.positionals, false);
        await remove(packages, { pkgManagerName });
      });
    } else if (cmd === "run") {
      const script = options.positionals[1];
      if (!script) {
        console.error(kl.red(`Missing script argument.`));
        console.log();
        printHelp();
        process.exit(1);
      }
      run(async () => {
        await runScript(process.cwd(), script, { pkgManagerName });
      });
    } else {
      const packageJsonPath = path.join(process.cwd(), "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8"),
        );
        if (packageJson.scripts && packageJson.scripts[cmd]) {
          run(async () => {
            await runScript(process.cwd(), cmd, { pkgManagerName });
          });
        } else {
          throwUnknownCommand(cmd);
        }
      } else {
        throwUnknownCommand(cmd);
      }
    }
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
    } else if (err instanceof ExecError) {
      console.log(kl.red(err.message));
      process.exit(err.code);
    }

    throw err;
  }
}

function throwUnknownCommand(cmd: string) {
  console.error(kl.red(`Unknown command: ${cmd}`));
  console.log();
  printHelp();
  process.exit(1);
}
