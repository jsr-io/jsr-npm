// Copyright the JSR authors. MIT license.

import * as fs from "node:fs";
import * as path from "node:path";

const DENO_VERSION_FILE = path.join(
  import.meta.dirname,
  "../src/deno_version.ts",
);

const FILENAMES = [
  "deno-aarch64-apple-darwin",
  "deno-x86_64-apple-darwin",
  "deno-aarch64-unknown-linux-gnu",
  "deno-x86_64-unknown-linux-gnu",
  "deno-x86_64-pc-windows-msvc",
];

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

  console.log("Fetching SHA256 hashes...");
  const hashes = await fetchHashes(latestVersion);

  await updateDenoVersion(latestVersion, hashes);
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

async function fetchHashes(
  version: string,
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};

  for (const name of FILENAMES) {
    const filename = `${name}.zip`;
    const url = `https://dl.deno.land/release/${version}/${filename}.sha256sum`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch hash for ${filename}: ${res.status} ${res.statusText}`,
      );
    }
    const text = (await res.text()).trim();
    // unix format: "<hash>  <filename>"
    // windows format (powershell Get-FileHash):
    //   Algorithm : SHA256
    //   Hash      : <HASH>
    //   Path      : ...
    let hash: string | undefined;
    const hashLineMatch = text.match(/^Hash\s*:\s*([0-9a-fA-F]{64})/m);
    if (hashLineMatch) {
      hash = hashLineMatch[1].toLowerCase();
    } else {
      hash = text.split(/\s+/)[0];
    }
    if (!hash || !/^[0-9a-f]{64}$/.test(hash)) {
      throw new Error(`Invalid hash for ${filename}: ${text}`);
    }
    hashes[filename] = hash;
    console.log(`  ${filename}: ${hash}`);
  }

  return hashes;
}

async function updateDenoVersion(
  version: string,
  hashes: Record<string, string>,
): Promise<void> {
  const hashEntries = Object.entries(hashes)
    .map(([filename, hash]) => `    "${filename}": "${hash}",`)
    .join("\n");

  const content = `export const denoVersionInfo = {
  version: "${version}",
  hashes: {
${hashEntries}
  } as Record<string, string>,
};
`;
  await fs.promises.writeFile(DENO_VERSION_FILE, content, "utf-8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
