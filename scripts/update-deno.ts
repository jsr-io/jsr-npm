// Copyright the JSR authors. MIT license.

import * as fs from "node:fs";
import * as path from "node:path";

const DENO_VERSION_FILE = path.join(
  import.meta.dirname,
  "../src/deno_version.ts",
);

async function main() {
  console.log("Fetching latest Deno version...");
  const latestVersion = await getLatestDenoVersion();
  console.log(`Latest Deno version: ${latestVersion}`);

  // read current version
  const currentContent = await fs.promises.readFile(DENO_VERSION_FILE, "utf-8");
  const match = currentContent.match(/version:\s*"([^"]+)"/);
  const currentVersion = match?.[1] ?? "unknown";

  if (currentVersion === latestVersion) {
    console.log("Already up to date!");
    return;
  }

  console.log(`Updating from ${currentVersion} to ${latestVersion}...`);
  await updateDenoVersion(latestVersion);
  console.log("Done!");
}

async function getLatestDenoVersion(): Promise<string> {
  const res = await fetch("https://dl.deno.land/release-latest.txt");

  if (!res.ok) {
    throw new Error(
      `Failed to fetch latest Deno version: ${res.status} ${res.statusText}`,
    );
  }

  const version = (await res.text()).trim();
  return version.startsWith("v") ? version : `v${version}`;
}

async function updateDenoVersion(version: string): Promise<void> {
  const content = `export const denoVersionInfo = {
  version: "${version}",
};
`;
  await fs.promises.writeFile(DENO_VERSION_FILE, content, "utf-8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
