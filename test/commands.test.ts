import * as path from "path";
import * as fs from "fs";
import * as kl from "kolorist";
import {
  DenoJson,
  enableYarnBerry,
  isDirectory,
  isFile,
  runInTempDir,
  runJsr,
  withTempEnv,
} from "./test_utils";
import * as assert from "node:assert/strict";
import {
  exec,
  ExecError,
  PkgJson,
  readJson,
  readTextFile,
  writeJson,
  writeTextFile,
} from "../src/utils";

describe("general", () => {
  it("exit 1 on unknown command", async () => {
    try {
      await withTempEnv(["foo"], async () => {});
      assert.fail("no");
    } catch (err) {
      if (err instanceof Error) {
        assert.match(err.message, /Child process/);
        assert.equal((err as any).code, 1);
      } else {
        throw err;
      }
    }
  });

  // See https://github.com/jsr-io/jsr-npm/issues/79
  it("exit 1 on unknown command in empty folder", async () => {
    await runInTempDir(async (dir) => {
      try {
        await runJsr(["asdf"], dir);
        assert.fail("no");
      } catch (err) {
        if (err instanceof Error) {
          assert.match(err.message, /Child process/);
          assert.equal((err as any).code, 1);
        } else {
          throw err;
        }
      }
    });
  });
});

describe("install", () => {
  it("jsr i @std/encoding - resolve latest version", async () => {
    await withTempEnv(["i", "@std/encoding"], async (dir) => {
      const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
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
      const npmRc = await readTextFile(npmrcPath);
      assert.ok(
        npmRc.includes("@jsr:registry=https://npm.jsr.io"),
        "Missing npmrc registry",
      );
    });

    await runInTempDir(async (dir) => {
      await enableYarnBerry(dir);
      await writeTextFile(path.join(dir, "yarn.lock"), "");

      await runJsr(["i", "@std/encoding"], dir);

      const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
      assert.ok(
        pkgJson.dependencies && "@std/encoding" in pkgJson.dependencies,
        "Missing dependency entry",
      );

      assert.match(
        pkgJson.dependencies["@std/encoding"],
        /^npm:@jsr\/std__encoding@\^\d+\.\d+\.\d+.*$/,
      );

      const yarnRc = await readTextFile(path.join(dir, ".yarnrc.yml"));
      assert.ok(
        /jsr:\s*npmRegistryServer: "https:\/\/npm\.jsr\.io"/.test(yarnRc),
        "Missing yarnrc.yml registry",
      );
    });
  });

  it("jsr i @std/encoding - adds to nearest package.json", async () => {
    await runInTempDir(async (dir) => {
      const parentPkgJson = { name: "", private: true };
      const parentPkgJsonPath = path.join(dir, "package.json");
      await writeJson<PkgJson>(parentPkgJsonPath, parentPkgJson);

      // Create sub folder with package.json
      const subPkgJsonPath = path.join(dir, "sub", "package.json");
      await writeJson(subPkgJsonPath, { name: "foo" });

      await runJsr(["i", "@std/encoding"], path.join(dir, "sub"));

      assert.deepEqual(
        await readJson<PkgJson>(path.join(dir, "package.json")),
        parentPkgJson,
      );

      const pkgJson = await readJson<PkgJson>(subPkgJsonPath);
      assert.ok(
        pkgJson.dependencies && "@std/encoding" in pkgJson.dependencies,
        "Missing dependency entry",
      );

      assert.match(
        pkgJson.dependencies["@std/encoding"],
        /^npm:@jsr\/std__encoding@\^\d+\.\d+\.\d+.*$/,
      );
    });
  });

  it("jsr i @std/encoding - inside workspace member", async () => {
    await runInTempDir(async (dir) => {
      const parentPkgJson = { name: "", private: true, workspaces: ["sub"] };
      const parentPkgJsonPath = path.join(dir, "package.json");
      await writeJson<PkgJson>(parentPkgJsonPath, parentPkgJson);

      // Create sub folder with package.json
      const subPkgJsonPath = path.join(dir, "sub", "package.json");
      await writeJson(subPkgJsonPath, { name: "foo" });

      await runJsr(["i", "@std/encoding"], path.join(dir, "sub"));

      assert.deepEqual(
        await readJson<PkgJson>(path.join(dir, "package.json")),
        parentPkgJson,
      );

      const pkgJson = await readJson<PkgJson>(subPkgJsonPath);
      assert.ok(
        pkgJson.dependencies && "@std/encoding" in pkgJson.dependencies,
        "Missing dependency entry",
      );

      assert.match(
        pkgJson.dependencies["@std/encoding"],
        /^npm:@jsr\/std__encoding@\^\d+\.\d+\.\d+.*$/,
      );

      const npmRc = await readTextFile(path.join(dir, ".npmrc"));
      assert.ok(
        npmRc.includes("@jsr:registry=https://npm.jsr.io"),
        "Missing npmrc registry",
      );
    });
  });

  it("jsr i @std/encoding - inside pnpm workspace member", async () => {
    await runInTempDir(async (dir) => {
      const parentPkgJson = { name: "", private: true };
      const parentPkgJsonPath = path.join(dir, "package.json");
      await writeJson<PkgJson>(parentPkgJsonPath, parentPkgJson);
      await writeTextFile(path.join(dir, "pnpm-workspace.yaml"), "");

      // Create sub folder with package.json
      const subPkgJsonPath = path.join(dir, "sub", "package.json");
      await writeJson(subPkgJsonPath, { name: "foo" });

      await runJsr(["i", "--pnpm", "@std/encoding"], path.join(dir, "sub"));

      assert.deepEqual(
        await readJson<PkgJson>(path.join(dir, "package.json")),
        parentPkgJson,
      );

      const pkgJson = await readJson<PkgJson>(subPkgJsonPath);
      assert.ok(
        pkgJson.dependencies && "@std/encoding" in pkgJson.dependencies,
        "Missing dependency entry",
      );

      assert.match(
        pkgJson.dependencies["@std/encoding"],
        /^npm:@jsr\/std__encoding@\^?\d+\.\d+\.\d+.*$/,
      );

      const npmRc = await readTextFile(path.join(dir, ".npmrc"));
      assert.ok(
        npmRc.includes("@jsr:registry=https://npm.jsr.io"),
        "Missing npmrc registry",
      );
    });
  });

  it("jsr i @std/encoding@0.216.0 - with version", async () => {
    await withTempEnv(["i", "@std/encoding@0.216.0"], async (dir) => {
      const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
      assert.deepEqual(pkgJson.dependencies, {
        "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
      });
    });
  });

  it("jsr install @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(["i", "@std/encoding@0.216.0"], async (dir) => {
      const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
      assert.deepEqual(pkgJson.dependencies, {
        "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
      });
    });
  });

  it("jsr add @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(["i", "@std/encoding@0.216.0"], async (dir) => {
      const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
      assert.deepEqual(pkgJson.dependencies, {
        "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
      });
    });
  });

  it("jsr add -D @std/encoding@0.216.0 - dev dependency", async () => {
    await withTempEnv(
      ["i", "-D", "@std/encoding@0.216.0"],
      async (dir) => {
        const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
        assert.deepEqual(pkgJson.devDependencies, {
          "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
        });
      },
    );

    await withTempEnv(
      ["i", "--save-dev", "@std/encoding@0.216.0"],
      async (dir) => {
        const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
        assert.deepEqual(pkgJson.devDependencies, {
          "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
        });
      },
    );

    await runInTempDir(async (dir) => {
      await enableYarnBerry(dir);
      await writeTextFile(path.join(dir, "yarn.lock"), "");

      await runJsr(["i", "--save-dev", "@std/encoding@0.216.0"], dir);

      assert.ok(
        await isFile(path.join(dir, ".yarnrc.yml")),
        "yarnrc file not created",
      );
      const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
      assert.deepEqual(pkgJson.devDependencies, {
        "@std/encoding": "npm:@jsr/std__encoding@0.216.0",
      });
    });

    if (process.platform !== "win32") {
      await withTempEnv(
        ["i", "--bun", "--save-dev", "@std/encoding@0.216.0"],
        async (dir) => {
          assert.ok(
            await isFile(path.join(dir, "bun.lockb")),
            "bun lockfile not created",
          );
          const pkgJson = await readJson<PkgJson>(
            path.join(dir, "package.json"),
          );
          assert.deepEqual(pkgJson.devDependencies, {
            "@std/encoding": "npm:@jsr/std__encoding@0.216.0",
          });
        },
      );
    }
  });

  it("jsr add -O @std/encoding@0.216.0 - dev dependency", async () => {
    await withTempEnv(
      ["i", "-O", "@std/encoding@0.216.0"],
      async (dir) => {
        const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
        assert.deepEqual(pkgJson.optionalDependencies, {
          "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
        });
      },
    );

    await withTempEnv(
      ["i", "--save-optional", "@std/encoding@0.216.0"],
      async (dir) => {
        const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
        assert.deepEqual(pkgJson.optionalDependencies, {
          "@std/encoding": "npm:@jsr/std__encoding@^0.216.0",
        });
      },
    );

    await runInTempDir(async (dir) => {
      await enableYarnBerry(dir);
      await fs.promises.writeFile(path.join(dir, "yarn.lock"), "");

      await runJsr(["i", "--save-optional", "@std/encoding@0.216.0"], dir);

      assert.ok(
        await isFile(path.join(dir, ".yarnrc.yml")),
        "yarnrc file not created",
      );
      const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
      assert.deepEqual(pkgJson.optionalDependencies, {
        "@std/encoding": "npm:@jsr/std__encoding@0.216.0",
      });
    });

    if (process.platform !== "win32") {
      await withTempEnv(
        ["i", "--bun", "--save-optional", "@std/encoding@0.216.0"],
        async (dir) => {
          assert.ok(
            await isFile(path.join(dir, "bun.lockb")),
            "bun lockfile not created",
          );
          const pkgJson = await readJson<PkgJson>(
            path.join(dir, "package.json"),
          );
          assert.deepEqual(pkgJson.optionalDependencies, {
            "@std/encoding": "npm:@jsr/std__encoding@0.216.0",
          });
        },
      );
    }
  });

  it("jsr i - runs '<pkg-manager> install' instead", async () => {
    await runInTempDir(async (dir) => {
      await runJsr(["i", "@std/encoding"], dir);

      assert.ok(
        fs.existsSync(path.join(dir, "node_modules")),
        "No node_modules created.",
      );

      await fs.promises.rm(path.join(dir, "node_modules"), { recursive: true });

      await runJsr(["i"], dir);
      assert.ok(
        fs.existsSync(path.join(dir, "node_modules")),
        "No node_modules created.",
      );
    });
  });

  it("jsr add --npm @std/encoding@0.216.0 - forces npm", async () => {
    await withTempEnv(
      ["i", "--npm", "@std/encoding@0.216.0"],
      async (dir) => {
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
      async (dir) => {
        assert.ok(
          await isFile(path.join(dir, "yarn.lock")),
          "yarn lockfile not created",
        );
      },
    );

    await runInTempDir(async (dir) => {
      await enableYarnBerry(dir);

      await runJsr(["i", "--yarn", "@std/encoding@0.216.0"], dir);

      assert.ok(
        await isFile(path.join(dir, "yarn.lock")),
        "yarn lockfile not created",
      );
      assert.ok(
        await isFile(path.join(dir, ".yarnrc.yml")),
        "yarnrc file not created",
      );
    });
  });

  it("jsr add --pnpm @std/encoding@0.216.0 - forces pnpm", async () => {
    await withTempEnv(
      ["i", "--pnpm", "@std/encoding@0.216.0"],
      async (dir) => {
        assert.ok(
          await isFile(path.join(dir, "pnpm-lock.yaml")),
          "pnpm lockfile not created",
        );
      },
    );
  });

  it("pnpm install into existing project", async () => {
    await runInTempDir(async (dir) => {
      const sub = path.join(dir, "sub", "sub1");
      await fs.promises.mkdir(sub, {
        recursive: true,
      });

      await exec("pnpm", ["i", "preact"], dir);

      await runJsr(["i", "--pnpm", "@std/encoding@0.216.0"], sub);
      assert.ok(
        await isFile(path.join(dir, "pnpm-lock.yaml")),
        "pnpm lockfile not created",
      );
    });
  });

  if (process.platform !== "win32") {
    it("jsr add --bun @std/encoding@0.216.0 - forces bun", async () => {
      await withTempEnv(
        ["i", "--bun", "@std/encoding@0.216.0"],
        async (dir) => {
          assert.ok(
            await isFile(path.join(dir, "bun.lockb")),
            "bun lockfile not created",
          );

          const config = await readTextFile(path.join(dir, "bunfig.toml"));
          assert.match(config, /"@jsr"\s+=/, "bunfig.toml not created");
        },
      );
    });
    it("jsr add --bun @std/encoding@0.216.0 - forces bun for twice", async () => {
      await withTempEnv(
        ["i", "--bun", "@std/encoding@0.216.0"],
        async (dir) => {
          await runJsr(["i", "--bun", "@std/encoding@0.216.0"], dir);
          const config = await readTextFile(path.join(dir, "bunfig.toml"));
          assert.match(config, /"@jsr"\s+=/, "bunfig.toml not created");
        },
      );
    });
  }

  describe("env detection", () => {
    it("detect pnpm from npm_config_user_agent", async () => {
      await withTempEnv(
        ["i", "@std/encoding@0.216.0"],
        async (dir) => {
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

    it("overwrite detection with arg from npm_config_user_agent", async () => {
      await withTempEnv(
        ["i", "--npm", "@std/encoding@0.216.0"],
        async (dir) => {
          assert.ok(
            await isFile(path.join(dir, "package-lock.json")),
            "npm lockfile not created",
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

    it("detect yarn from npm_config_user_agent", async () => {
      await withTempEnv(
        ["i", "@std/encoding@0.216.0"],
        async (dir) => {
          assert.ok(
            await isFile(path.join(dir, "yarn.lock")),
            "yarn lockfile not created",
          );
        },
        {
          env: {
            ...process.env,
            npm_config_user_agent:
              `yarn/1.22.19 ${process.env.npm_config_user_agent}`,
          },
        },
      );

      await runInTempDir(async (dir) => {
        await enableYarnBerry(dir);

        await runJsr(["i", "@std/encoding@0.216.0"], dir, {
          npm_config_user_agent:
            `yarn/4.1.0 ${process.env.npm_config_user_agent}`,
        });

        assert.ok(
          await isFile(path.join(dir, "yarn.lock")),
          "yarn lockfile not created",
        );
        assert.ok(
          await isFile(path.join(dir, ".yarnrc.yml")),
          "yarnrc file not created",
        );
      });
    });

    if (process.platform !== "win32") {
      it("detect bun from npm_config_user_agent", async () => {
        await withTempEnv(
          ["i", "@std/encoding@0.216.0"],
          async (dir) => {
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
      async (dir) => {
        await runJsr(["r", "@std/encoding"], dir);

        const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
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
      async (dir) => {
        await runJsr(["r", "@std/encoding"], dir);

        const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
        assert.equal(pkgJson.dependencies, undefined);
      },
    );
  });

  it("jsr remove @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(
      ["i", "@std/encoding@0.216.0"],
      async (dir) => {
        await runJsr(["remove", "@std/encoding"], dir);

        const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
        assert.equal(pkgJson.dependencies, undefined);
      },
    );
  });

  it("jsr uninstall @std/encoding@0.216.0 - command", async () => {
    await withTempEnv(
      ["i", "@std/encoding@0.216.0"],
      async (dir) => {
        await runJsr(["uninstall", "@std/encoding"], dir);

        const pkgJson = await readJson<PkgJson>(path.join(dir, "package.json"));
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
      await writeJson(pkgJsonPath, pkgJson);

      await writeTextFile(
        path.join(dir, "mod.ts"),
        "export const value = 42;",
      );

      // TODO: Change this once deno supports jsr.json
      await writeJson<DenoJson>(path.join(dir, "deno.json"), {
        name: "@deno/jsr-cli-test",
        version: pkgJson.version!,
        exports: {
          ".": "./mod.ts",
        },
      });

      await runJsr(["publish", "--dry-run"], dir);
    });
  }).timeout(600000);

  it("should not add unstable publish flags for a Deno project", async () => {
    await runInTempDir(async (dir) => {
      const pkgJsonPath = path.join(dir, "package.json");
      await fs.promises.rm(pkgJsonPath);

      await writeTextFile(
        path.join(dir, "mod.ts"),
        ["import * as fs from 'fs';", "console.log(fs)"].join("\n"),
      );

      await writeJson<DenoJson>(path.join(dir, "deno.json"), {
        name: "@deno/jsr-cli-test",
        version: "0.0.1",
        exports: {
          ".": "./mod.ts",
        },
      });

      try {
        await runJsr(["publish", "--dry-run"], dir);
        assert.fail();
      } catch (err) {
        assert.ok(err instanceof ExecError, `Unknown exec error thrown`);
      }
    });
  }).timeout(600000);

  it("should leave node_modules as is", async () => {
    await runInTempDir(async (dir) => {
      const pkgJsonPath = path.join(dir, "package.json");
      const pkgJson = await readJson<PkgJson>(pkgJsonPath);
      pkgJson.exports = {
        ".": "./mod.js",
      };
      await writeJson(pkgJsonPath, pkgJson);

      // Add dependency
      await runJsr(["i", "--npm", "@std/encoding@0.216.0"], dir);

      await writeTextFile(
        path.join(dir, "mod.ts"),
        [
          'import * as encoding from "@std/encoding/hex";',
          "console.log(encoding);",
          "export const value = 42;",
        ].join("\n"),
      );

      await writeJson<DenoJson>(path.join(dir, "jsr.json"), {
        name: "@deno/jsr-cli-test",
        version: pkgJson.version!,
        exports: {
          ".": "./mod.ts",
        },
      });

      await runJsr(["publish", "--dry-run"], dir);

      assert.ok(
        !(await isDirectory(path.join(dir, "node_modules", ".deno"))),
        ".deno found inside node_modules",
      );
    });
  });

  // Windows doesn't support #!/usr/bin/env
  if (process.platform !== "win32") {
    it("use deno binary from DENO_BIN_PATH when set", async () => {
      await runInTempDir(async (dir) => {
        await writeTextFile(
          path.join(dir, "mod.ts"),
          "export const value = 42;",
        );

        // TODO: Change this once deno supports jsr.json
        await writeJson<DenoJson>(path.join(dir, "deno.json"), {
          name: "@deno/jsr-cli-test",
          version: "1.0.0",
          exports: {
            ".": "./mod.ts",
          },
        });

        await runJsr(["publish", "--dry-run", "--non-existant-option"], dir, {
          DENO_BIN_PATH: path.join(__dirname, "fixtures", "dummy.js"),
        });
      });
    });
  }
});

describe("run", () => {
  it("should run a script", async () => {
    await runInTempDir(async (dir) => {
      const pkgJsonPath = path.join(dir, "package.json");
      const pkgJson = await readJson<PkgJson>(pkgJsonPath);
      pkgJson.scripts = {
        test: 'echo "test"',
      };
      await writeJson(pkgJsonPath, pkgJson);

      await runJsr(["run", "test"], dir);
    });
  });

  it("should run a script without the run command", async () => {
    await runInTempDir(async (dir) => {
      const pkgJsonPath = path.join(dir, "package.json");
      const pkgJson = await readJson<PkgJson>(pkgJsonPath);
      pkgJson.scripts = {
        test: 'echo "test"',
      };
      await writeJson(pkgJsonPath, pkgJson);

      await runJsr(["test"], dir);
    });
  });
});

describe("show", () => {
  it("should show package information", async () => {
    const output = await runJsr(
      ["show", "@std/encoding"],
      process.cwd(),
      undefined,
      true,
    );
    const txt = kl.stripColors(output);
    assert.ok(txt.includes("latest:"));
    assert.ok(txt.includes("npm tarball:"));
  });

  it("can use 'view' alias", async () => {
    await runJsr(
      ["view", "@std/encoding"],
      process.cwd(),
    );
  });

  it("can use 'info' alias", async () => {
    await runJsr(
      ["view", "@std/encoding"],
      process.cwd(),
    );
  });

  it("should show package information for pre-release only packages", async () => {
    const output = await runJsr(
      ["show", "@fresh/update"],
      process.cwd(),
      undefined,
      true,
    );
    const txt = kl.stripColors(output);
    assert.ok(txt.includes("latest: -"));
    assert.ok(txt.includes("npm tarball:"));
  });
});

describe("setup", () => {
  it("jsr setup - should generate .npmrc file", async () => {
    await runInTempDir(async (dir) => {
      await runJsr(["setup"], dir);

      const npmrcPath = path.join(dir, ".npmrc");
      const npmRc = await readTextFile(npmrcPath);
      assert.ok(
        npmRc.includes("@jsr:registry=https://npm.jsr.io"),
        "Missing npmrc registry",
      );
    });
  });

  it("jsr setup - should generate .yarnrc.yml if yarn berry is detected", async () => {
    await runInTempDir(async (dir) => {
      await enableYarnBerry(dir);
      await writeTextFile(path.join(dir, "yarn.lock"), "");

      await runJsr(["setup"], dir);

      const yarnRc = await readTextFile(path.join(dir, ".yarnrc.yml"));
      assert.ok(
        /jsr:\s*npmRegistryServer: "https:\/\/npm\.jsr\.io"/.test(yarnRc),
        "Missing yarnrc.yml registry",
      );
    });
  });

  it("jsr setup - should generate bunfig.toml if bun is detected", async () => {
    await runInTempDir(async (dir) => {
      await runJsr(["setup", "--bun"], dir);

      const config = await readTextFile(path.join(dir, "bunfig.toml"));
      assert.match(config, /"@jsr"\s+=/, "bunfig.toml not created");
    });
  });
});
