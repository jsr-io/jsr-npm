import * as path from "path";
import { runInTempDir } from "./test_utils";
import { setupNpmRc } from "../src/commands";
import * as assert from "assert/strict";
import { NpmPackage, readTextFile, writeTextFile } from "../src/utils";

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

describe("NpmPackage", () => {
  it("parse", () => {
    assert.equal(NpmPackage.from("foo").toString(), "foo");
    assert.equal(NpmPackage.from("foo-bar").toString(), "foo-bar");
    assert.equal(
      NpmPackage.from("@foo-bar/foo-bar").toString(),
      "@foo-bar/foo-bar",
    );
    assert.throws(
      () => NpmPackage.from("@foo-bar@1.0.0").toString(),
      "@foo-bar@1.0.0",
    );
    assert.equal(
      NpmPackage.from("@foo-bar/baz@1.0.0").toString(),
      "@foo-bar/baz@1.0.0",
    );
  });
});
