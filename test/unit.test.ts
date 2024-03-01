import * as path from "path";
import * as fs from "fs";
import { runInTempDir } from "./test_utils";
import { setupNpmRc } from "../src/commands";
import * as assert from "assert/strict";

describe("npmrc", () => {
  it("doesn't overwrite exising jsr mapping", async () => {
    await runInTempDir(async (dir) => {
      const npmrc = path.join(dir, ".npmrc");
      await fs.promises.writeFile(
        npmrc,
        "@jsr:registry=https://example.com\n",
        "utf-8",
      );

      await setupNpmRc(dir);

      const content = await fs.promises.readFile(npmrc, "utf-8");
      assert.equal(content.trim(), "@jsr:registry=https://example.com");
    });
  });
});
