import * as path from "node:path";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInTempDir } from "./test_utils.ts";
import { setupNpmRc } from "../src/commands.ts";
import { NpmPackage, readTextFile, writeTextFile } from "../src/utils.ts";

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
  it("parses npm package names", () => {
    assert.equal(NpmPackage.from("foo").toString(), "foo");
    assert.equal(NpmPackage.from("foo-bar").toString(), "foo-bar");
    assert.equal(NpmPackage.from("foo.bar").toString(), "foo.bar");
    assert.equal(NpmPackage.from("foo@1.0.0").toString(), "foo@1.0.0");
    assert.equal(NpmPackage.from("foo@^2").toString(), "foo@^2");
    assert.equal(
      NpmPackage.from("@foo-bar/baz").toString(),
      "@foo-bar/baz",
    );
    assert.equal(
      NpmPackage.from("@foo/bar@1.0.0-alpha.1").toString(),
      "@foo/bar@1.0.0-alpha.1",
    );
  });

  it("throws on invalid npm package names", () => {
    assert.throws(() => NpmPackage.from(""));
    assert.throws(() => NpmPackage.from("!invalid"));
    assert.throws(() => NpmPackage.from("@scope/"));
    assert.throws(() => NpmPackage.from("@/name"));
  });
});
