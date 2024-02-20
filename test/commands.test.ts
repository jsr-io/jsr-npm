import * as path from "path";
import { isDirectory, isFile, runJsr, withTempEnv } from "./test_utils";
import * as assert from "node:assert/strict";

describe("install", () => {
  it("jsr i @std/encoding - resolve latest version", async () => {
    await withTempEnv(["i", "@std/encoding"], async (getPkgJson, dir) => {
      const pkgJson = await getPkgJson();
      assert.ok(
        pkgJson.dependencies && "@std/encoding" in pkgJson.dependencies,
        "Missing dependency entry"
      );

      assert.match(
        pkgJson.dependencies["@std/encoding"],
        /^npm:@jsr\/std__encoding@\^\d+\.\d+\.\d+.*$/
      );

      const depPath = path.join(dir, "node_modules", "@std", "encoding");
      assert.ok(await isDirectory(depPath), "Not installed in node_modules");
    });
  });

  it("jsr i @std/encoding@0.216.0 - with version", async () => {
    await withTempEnv(["i", "@std/encoding@0.216.0"], async (getPkgJson) => {
      const pkgJson = await getPkgJson();
      assert.deepEqual(pkgJson.dependencies, {
        "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
      });
    });
  });

  it("jsr install @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(["i", "@std/encoding@0.216.0"], async (getPkgJson) => {
      const pkgJson = await getPkgJson();
      assert.deepEqual(pkgJson.dependencies, {
        "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
      });
    });
  });

  it("jsr add @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(["i", "@std/encoding@0.216.0"], async (getPkgJson) => {
      const pkgJson = await getPkgJson();
      assert.deepEqual(pkgJson.dependencies, {
        "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
      });
    });
  });

  it("jsr add -D @std/encoding@0.216.0 - dev dependency", async () => {
    await withTempEnv(
      ["i", "-D", "@std/encoding@0.216.0"],
      async (getPkgJson) => {
        const pkgJson = await getPkgJson();
        assert.deepEqual(pkgJson.devDependencies, {
          "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
        });
      }
    );

    await withTempEnv(
      ["i", "--save-dev", "@std/encoding@0.216.0"],
      async (getPkgJson) => {
        const pkgJson = await getPkgJson();
        assert.deepEqual(pkgJson.devDependencies, {
          "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
        });
      }
    );
  });

  it("jsr add -O @std/encoding@0.216.0 - dev dependency", async () => {
    await withTempEnv(
      ["i", "-O", "@std/encoding@0.216.0"],
      async (getPkgJson) => {
        const pkgJson = await getPkgJson();
        assert.deepEqual(pkgJson.optionalDependencies, {
          "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
        });
      }
    );

    await withTempEnv(
      ["i", "--save-optional", "@std/encoding@0.216.0"],
      async (getPkgJson) => {
        const pkgJson = await getPkgJson();
        assert.deepEqual(pkgJson.optionalDependencies, {
          "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
        });
      }
    );
  });

  it("jsr add --npm @std/encoding@0.216.0 - forces npm", async () => {
    await withTempEnv(
      ["i", "--npm", "@std/encoding@0.216.0"],
      async (_, dir) => {
        assert.ok(
          await isFile(path.join(dir, "package-lock.json")),
          "npm lockfile not created"
        );
      }
    );
  });

  it("jsr add --yarn @std/encoding@0.216.0 - forces yarn", async () => {
    await withTempEnv(
      ["i", "--yarn", "@std/encoding@0.216.0"],
      async (_, dir) => {
        assert.ok(
          await isFile(path.join(dir, "yarn.lock")),
          "yarn lockfile not created"
        );
      }
    );
  });

  it("jsr add --pnpm @std/encoding@0.216.0 - forces pnpm", async () => {
    await withTempEnv(
      ["i", "--pnpm", "@std/encoding@0.216.0"],
      async (_, dir) => {
        assert.ok(
          await isFile(path.join(dir, "pnpm-lock.yaml")),
          "pnpm lockfile not created"
        );
      }
    );
  });
});

describe("remove", () => {
  it("jsr r @std/encoding@0.216.0 - removes node_modules", async () => {
    await withTempEnv(
      ["i", "@std/encoding@0.216.0"],
      async (getPkgJson, dir) => {
        await runJsr(["r", "@std/encoding"], dir);

        const pkgJson = await getPkgJson();
        assert.equal(pkgJson.dependencies, undefined);

        const depPath = path.join(dir, "node_modules", "@std", "encoding");
        assert.ok(
          !(await isDirectory(depPath)),
          "Folder in node_modules not removed"
        );
      }
    );
  });

  it("jsr r @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(
      ["i", "@std/encoding@0.216.0"],
      async (getPkgJson, dir) => {
        await runJsr(["r", "@std/encoding"], dir);

        const pkgJson = await getPkgJson();
        assert.equal(pkgJson.dependencies, undefined);
      }
    );
  });

  it("jsr remove @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(
      ["i", "@std/encoding@0.216.0"],
      async (getPkgJson, dir) => {
        await runJsr(["remove", "@std/encoding"], dir);

        const pkgJson = await getPkgJson();
        assert.equal(pkgJson.dependencies, undefined);
      }
    );
  });

  it("jsr uninstall @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(
      ["i", "@std/encoding@0.216.0"],
      async (getPkgJson, dir) => {
        await runJsr(["uninstall", "@std/encoding"], dir);

        const pkgJson = await getPkgJson();
        assert.equal(pkgJson.dependencies, undefined);
      }
    );
  });
});
