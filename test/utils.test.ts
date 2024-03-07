import * as assert from "assert/strict";
import * as path from "node:path";
import { runInTempDir } from "./test_utils";
import { findProjectDir, writeJson, writeTextFile } from "../src/utils";

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
});
