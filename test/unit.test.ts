import * as path from "node:path";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInTempDir } from "./test_utils.ts";
import { setupNpmRc } from "../src/commands.ts";
import { readTextFile, writeTextFile } from "../src/utils.ts";

describe("npmrc", () => {
  it("doesn't overwrite exising jsr mapping", async () => {
    await runInTempDir(async (dir) => {
      const npmrc = path.join(dir, ".npmrc");
      await writeTextFile(npmrc, "@jsr:registry=https://example.com\n");

      await setupNpmRc(dir);

      const content = await readTextFile(npmrc);
      assert.equal(content.trim(), "@jsr:registry=https://example.com");
    });
  });

  it("adds newline in between entries if necessary", async () => {
    await runInTempDir(async (dir) => {
      const npmrc = path.join(dir, ".npmrc");
      await writeTextFile(npmrc, "@foo:registry=https://example.com");

      await setupNpmRc(dir);

      const content = await readTextFile(npmrc);
      assert.equal(
        content.trim(),
        [
          "@foo:registry=https://example.com",
          "@jsr:registry=https://npm.jsr.io",
        ].join("\n"),
      );
    });
  });
});
