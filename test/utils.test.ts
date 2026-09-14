import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, it } from "node:test";
import { runInTempDir } from "./test_utils.ts";
import {
  exec,
  findProjectDir,
  JsrPackage,
  type PkgJson,
  writeJson,
  writeTextFile,
} from "../src/utils.ts";

describe("exec", { skip: process.platform !== "win32" }, () => {
  it("preserves command shim lookup through PATH", async () => {
    await runInTempDir(async (dir) => {
      const binDir = path.join(dir, "bin");
      await fs.mkdir(binDir);
      await writeTextFile(
        path.join(binDir, "test-command.cmd"),
        '@echo off\r\ntype "%~dp0value.txt"\r\n',
      );
      await writeTextFile(path.join(binDir, "value.txt"), "shim output");
      const output = await exec(
        "test-command",
        [],
        dir,
        { ...process.env, PATH: `${binDir};${process.env.PATH}` },
        true,
      );
      assert.strictEqual(output.stdout, "shim output");
    });
  });

  it("runs executables from paths containing spaces", async () => {
    await runInTempDir(async (dir) => {
      const binDir = path.join(dir, "bin with spaces");
      await fs.mkdir(binDir);
      const executable = path.join(binDir, "node.exe");
      await fs.copyFile(process.execPath, executable);
      const script = path.join(dir, "script with spaces.js");
      await writeTextFile(script, "console.log(process.argv[2]);");

      const output = await exec(
        executable,
        [script, "argument with spaces"],
        dir,
        undefined,
        true,
      );
      assert.strictEqual(output.stdout.trim(), "argument with spaces");
    });
  });

  it("runs command shims from paths containing spaces", async () => {
    await runInTempDir(async (dir) => {
      const command = path.join(dir, "command with spaces.cmd");
      await writeTextFile(command, "@echo off\r\necho %~1\r\n");
      const output = await exec(
        command,
        ["argument with spaces"],
        dir,
        undefined,
        true,
      );
      assert.strictEqual(output.stdout.trim(), "argument with spaces");
    });
  });
});

describe("findProjectDir", () => {
  it("should return npm if package-lock.json is found", async () => {
    await runInTempDir(async (tempDir) => {
      await writeTextFile(path.join(tempDir, "package-lock.json"), "{}");
      const result = await findProjectDir(tempDir);
      assert.strictEqual(result.pkgManagerName, "npm");
    });
  });

  it("should return yarn if yarn.lock is found", async () => {
    await runInTempDir(async (tempDir) => {
      await writeTextFile(path.join(tempDir, "yarn.lock"), "");
      const result = await findProjectDir(tempDir);
      assert.strictEqual(result.pkgManagerName, "yarn");
    });
  });

  it("should return pnpm if pnpm-lock.yaml is found", async () => {
    await runInTempDir(async (tempDir) => {
      await writeTextFile(path.join(tempDir, "pnpm-lock.yaml"), "");
      const result = await findProjectDir(tempDir);
      assert.strictEqual(result.pkgManagerName, "pnpm");
    });
  });

  it("should return bun if bun.lockb is found", async () => {
    await runInTempDir(async (tempDir) => {
      await writeTextFile(path.join(tempDir, "bun.lockb"), "");
      const result = await findProjectDir(tempDir);
      assert.strictEqual(result.pkgManagerName, "bun");
    });
  });

  it("should return bun if bun.lock is found", async () => {
    await runInTempDir(async (tempDir) => {
      await writeTextFile(path.join(tempDir, "bun.lock"), "");
      const result = await findProjectDir(tempDir);
      assert.strictEqual(result.pkgManagerName, "bun");
    });
  });

  it("should return bun if bun.lockb and yarn.lock are found", async () => {
    // bun allow to save bun.lockb and yarn.lock
    // https://bun.sh/docs/install/lockfile
    await runInTempDir(async (tempDir) => {
      await writeTextFile(path.join(tempDir, "bun.lockb"), "");
      await writeTextFile(path.join(tempDir, "yarn.lock"), "");
      const result = await findProjectDir(tempDir);
      assert.strictEqual(result.pkgManagerName, "bun");
    });
  });

  it("should set project dir to nearest package.json", async () => {
    await runInTempDir(async (tempDir) => {
      const sub = path.join(tempDir, "sub");

      await writeJson(path.join(tempDir, "package.json"), {});
      await writeJson(path.join(sub, "package.json"), {});
      const result = await findProjectDir(sub);
      assert.strictEqual(result.projectDir, sub);
    });
  });

  it("should find workspace root folder", async () => {
    await runInTempDir(async (tempDir) => {
      const sub = path.join(tempDir, "sub");

      await writeJson<PkgJson>(path.join(tempDir, "package.json"), {
        workspaces: ["sub"],
      });
      await writeJson(path.join(sub, "package.json"), {});
      const result = await findProjectDir(sub);
      assert.strictEqual(
        result.root,
        tempDir,
      );
    });
  });

  it("should find workspace root folder with pnpm workspaces", async () => {
    await runInTempDir(async (tempDir) => {
      const sub = path.join(tempDir, "sub");

      await writeJson<PkgJson>(path.join(tempDir, "package.json"), {});
      await writeJson(path.join(sub, "package.json"), {});
      await writeTextFile(path.join(tempDir, "pnpm-workspace.yaml"), "");
      const result = await findProjectDir(sub);
      assert.strictEqual(
        result.root,
        tempDir,
      );
    });
  });
});

describe("JsrPackage", () => {
  it("should allow scopes starting with a number", () => {
    JsrPackage.from("@0abc/foo");
    JsrPackage.from("@jsr/0abc__foo");
  });
});
