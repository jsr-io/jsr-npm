import * as assert from "assert/strict";
import * as path from "node:path";
import { runInTempDir } from "./test_utils";
import {
  findProjectDir,
  JsrPackage,
  PkgJson,
  DenoJson,
  writeJson,
  writeTextFile,
} from "../src/utils";

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


  it("should find deno workspace root folder", async () => {
    await runInTempDir(async (tempDir) => {
      const sub = path.join(tempDir, "sub");

      await writeJson<DenoJson>(path.join(tempDir, "deno.json"), { workspace: ["./sub"] });
      await writeJson(path.join(sub, "deno.json"), {});
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
