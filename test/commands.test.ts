import * as path from "path";
import * as fs from "fs";
import {
  DenoJson,
  isDirectory,
  isFile,
  PkgJson,
  readJson,
  runInTempDir,
  runJsr,
  withTempEnv,
  writeJson,
} from "./test_utils";
import * as assert from "node:assert/strict";

describe("install", () => {
  it("jsr i @std/encoding - resolve latest version", async () => {
    await withTempEnv(["i", "@std/encoding"], async (getPkgJson, dir) => {
      const pkgJson = await getPkgJson();
      assert.ok(
        pkgJson.dependencies && "@std/encoding" in pkgJson.dependencies,
        "Missing dependency entry",
      );

      assert.match(
        pkgJson.dependencies["@std/encoding"],
        /^npm:@jsr\/std__encoding@\^\d+\.\d+\.\d+.*$/,
      );

      const depPath = path.join(dir, "node_modules", "@std", "encoding");
      assert.ok(await isDirectory(depPath), "Not installed in node_modules");

      const npmrcPath = path.join(dir, ".npmrc");
      const npmRc = await fs.promises.readFile(npmrcPath, "utf-8");
      assert.ok(
        npmRc.includes("@jsr:registry=https://npm.jsr.io"),
        "Missing npmrc registry",
      );
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
      },
    );

    await withTempEnv(
      ["i", "--save-dev", "@std/encoding@0.216.0"],
      async (getPkgJson) => {
        const pkgJson = await getPkgJson();
        assert.deepEqual(pkgJson.devDependencies, {
          "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
        });
      },
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
      },
    );

    await withTempEnv(
      ["i", "--save-optional", "@std/encoding@0.216.0"],
      async (getPkgJson) => {
        const pkgJson = await getPkgJson();
        assert.deepEqual(pkgJson.optionalDependencies, {
          "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
        });
      },
    );
  });

  it("jsr add --npm @std/encoding@0.216.0 - forces npm", async () => {
    await withTempEnv(
      ["i", "--npm", "@std/encoding@0.216.0"],
      async (_, dir) => {
        assert.ok(
          await isFile(path.join(dir, "package-lock.json")),
          "npm lockfile not created",
        );
      },
    );
  });

  it("jsr add --yarn @std/encoding@0.216.0 - forces yarn", async () => {
    await withTempEnv(
      ["i", "--yarn", "@std/encoding@0.216.0"],
      async (_, dir) => {
        assert.ok(
          await isFile(path.join(dir, "yarn.lock")),
          "yarn lockfile not created",
        );
      },
    );
  });

  it("jsr add --pnpm @std/encoding@0.216.0 - forces pnpm", async () => {
    await withTempEnv(
      ["i", "--pnpm", "@std/encoding@0.216.0"],
      async (_, dir) => {
        assert.ok(
          await isFile(path.join(dir, "pnpm-lock.yaml")),
          "pnpm lockfile not created",
        );
      },
    );
  });

  if (process.platform !== "win32") {
    it("jsr add --bun @std/encoding@0.216.0 - forces bun", async () => {
      await withTempEnv(
        ["i", "--bun", "@std/encoding@0.216.0"],
        async (_, dir) => {
          assert.ok(
            await isFile(path.join(dir, "bun.lockb")),
            "bun lockfile not created",
          );

          const config = await fs.promises.readFile(
            path.join(dir, "bunfig.toml"),
            "utf-8",
          );
          assert.match(config, /"@jsr"\s+=/, "bunfig.toml not created");
        },
      );
    });
  }

  describe("env detection", () => {
    it("detect pnpm from npm_config_user_agent", async () => {
      await withTempEnv(
        ["i", "@std/encoding@0.216.0"],
        async (_, dir) => {
          assert.ok(
            await isFile(path.join(dir, "pnpm-lock.yaml")),
            "pnpm lockfile not created",
          );
        },
        {
          env: {
            ...process.env,
            npm_config_user_agent:
              `pnpm/8.14.3 ${process.env.npm_config_user_agent}`,
          },
        },
      );
    });

    if (process.platform !== "win32") {
      it("detect bun from npm_config_user_agent", async () => {
        await withTempEnv(
          ["i", "@std/encoding@0.216.0"],
          async (_, dir) => {
            assert.ok(
              await isFile(path.join(dir, "bun.lockb")),
              "bun lockfile not created",
            );
          },
          {
            env: {
              ...process.env,
              npm_config_user_agent:
                `bun/1.0.29 ${process.env.npm_config_user_agent}`,
            },
          },
        );
      });
    }
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
          "Folder in node_modules not removed",
        );
      },
    );
  });

  it("jsr r @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(
      ["i", "@std/encoding@0.216.0"],
      async (getPkgJson, dir) => {
        await runJsr(["r", "@std/encoding"], dir);

        const pkgJson = await getPkgJson();
        assert.equal(pkgJson.dependencies, undefined);
      },
    );
  });

  it("jsr remove @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(
      ["i", "@std/encoding@0.216.0"],
      async (getPkgJson, dir) => {
        await runJsr(["remove", "@std/encoding"], dir);

        const pkgJson = await getPkgJson();
        assert.equal(pkgJson.dependencies, undefined);
      },
    );
  });

  it("jsr uninstall @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(
      ["i", "@std/encoding@0.216.0"],
      async (getPkgJson, dir) => {
        await runJsr(["uninstall", "@std/encoding"], dir);

        const pkgJson = await getPkgJson();
        assert.equal(pkgJson.dependencies, undefined);
      },
    );
  });
});

describe("publish", () => {
  it("should publish a package", async () => {
    await runInTempDir(async (dir) => {
      const pkgJsonPath = path.join(dir, "package.json");
      const pkgJson = await readJson<PkgJson>(pkgJsonPath);
      pkgJson.exports = {
        ".": "./mod.js",
      };
      await fs.promises.writeFile(
        pkgJsonPath,
        JSON.stringify(pkgJson),
        "utf-8",
      );

      await fs.promises.writeFile(
        path.join(dir, "mod.ts"),
        "export const value = 42;",
        "utf-8",
      );

      // TODO: Change this once deno supports jsr.json
      await writeJson<DenoJson>(path.join(dir, "deno.json"), {
        name: "@deno/jsr-cli-test",
        version: pkgJson.version,
        exports: {
          ".": "./mod.ts",
        },
      });

      await runJsr(["publish", "--dry-run", "--token", "dummy-token"], dir);
    });
  }).timeout(600000);
});
