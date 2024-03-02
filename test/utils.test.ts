import * as assert from "assert/strict";
import * as fs from "fs";
import * as path from "node:path";
import { runInTempDir } from "./test_utils";
import { findProjectDir } from "../src/utils";

describe("findProjectDir", () => {
    it("should return npm if package-lock.json is found", async () => {
        await runInTempDir(async (tempDir) => {
            await fs.promises.writeFile(path.join(tempDir, "package-lock.json"), "{}", "utf-8");
            const result = await findProjectDir(tempDir);
            assert.strictEqual(result.pkgManagerName, "npm");
        });
    });
    it("should return yarn if yarn.lock is found", async () => {
        await runInTempDir(async (tempDir) => {
            await fs.promises.writeFile(path.join(tempDir, "yarn.lock"), "", "utf-8");
            const result = await findProjectDir(tempDir);
            assert.strictEqual(result.pkgManagerName, "yarn");
        });
    });
    it("should return pnpm if pnpm-lock.yaml is found", async () => {
        await runInTempDir(async (tempDir) => {
            await fs.promises.writeFile(path.join(tempDir, "pnpm-lock.yaml"), "", "utf-8");
            const result = await findProjectDir(tempDir);
            assert.strictEqual(result.pkgManagerName, "pnpm");
        });
    });
    it("should return bun if bun.lockb is found", async () => {
        await runInTempDir(async (tempDir) => {
            await fs.promises.writeFile(path.join(tempDir, "bun.lockb"), "", "utf-8");
            const result = await findProjectDir(tempDir);
            assert.strictEqual(result.pkgManagerName, "bun");
        });
    });
    it("should return bun if bun.lockb and yarn.lock are found", async () => {
        // bun allow to save bun.lockb and yarn.lock
        // https://bun.sh/docs/install/lockfile
        await runInTempDir(async (tempDir) => {
            await fs.promises.writeFile(path.join(tempDir, "bun.lockb"), "", "utf-8");
            await fs.promises.writeFile(path.join(tempDir, "yarn.lock"), "", "utf-8");
            const result = await findProjectDir(tempDir);
            assert.strictEqual(result.pkgManagerName, "bun");
        });
    });
});
