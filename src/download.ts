// Copyright 2024 the JSR authors. MIT license.
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import * as util from "node:util";
import * as stream from "node:stream";
import StreamZipPkg from "node-stream-zip";
import { styleText } from "./utils.ts";

const { async } = StreamZipPkg;

const streamFinished = util.promisify(stream.finished);

const DENO_CANARY_INFO_URL = "https://dl.deno.land/canary-latest.txt";
const DENO_RELEASE_INFO_URL = "https://dl.deno.land/release-latest.txt";

// Example: https://github.com/denoland/deno/releases/download/v1.41.0/deno-aarch64-apple-darwin.zip
// Example: https://dl.deno.land/canary/d722de886b85093eeef08d1e9fd6f3193405762d/deno-aarch64-apple-darwin.zip
const FILENAMES: Record<string, string> = {
  "darwin arm64": "deno-aarch64-apple-darwin",
  "darwin x64": "deno-x86_64-apple-darwin",
  "linux arm64": "deno-aarch64-unknown-linux-gnu",
  "linux x64": "deno-x86_64-unknown-linux-gnu",
  "win32 x64": "deno-x86_64-pc-windows-msvc",
};

export interface DownloadInfo {
  url: string;
  filename: string;
  version: string;
  canary: boolean;
}

export async function getDenoDownloadUrl(
  canary: boolean,
): Promise<DownloadInfo> {
  const key = `${process.platform} ${os.arch()}`;
  if (!(key in FILENAMES)) {
    throw new Error(`Unsupported platform: ${key}`);
  }

  const name = FILENAMES[key];
  const filename = name + ".zip";

  const url = canary ? DENO_CANARY_INFO_URL : DENO_RELEASE_INFO_URL;
  const res = await fetch(url);
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(
      `${res.status}: Unable to retrieve ${
        canary ? "canary" : "release"
      } version information from ${url}.`,
    );
  }
  let version = (await res.text()).trim();
  // TODO(bartlomieju): temporary workaround for https://github.com/jsr-io/jsr-npm/issues/129
  // until it's fixed upstream in Deno
  if (!canary) {
    version = "v2.3.7"
  }

  return {
    canary,
    url: canary
      ? `https://dl.deno.land/canary/${decodeURI(version)}/${filename}`
      : `https://dl.deno.land/release/${decodeURI(version)}/${filename}`,
    filename,
    version: version,
  };
}

export async function downloadDeno(
  binPath: string,
  info: DownloadInfo,
): Promise<void> {
  const binFolder = path.dirname(binPath);

  await fs.promises.mkdir(binFolder, { recursive: true });

  const res = await fetch(info.url);
  const contentLen = Number(res.headers.get("content-length") ?? Infinity);
  if (res.body == null) {
    throw new Error(`Unexpected empty body`);
  }

  console.log(
    `Downloading JSR ${info.canary ? "canary" : "release"} binary...`,
  );

  await withProgressBar(
    async (tick) => {
      const tmpFile = path.join(binFolder, info.filename + ".part");
      const writable = fs.createWriteStream(tmpFile, "utf-8");

      for await (const chunk of streamToAsyncIterable(res.body!)) {
        tick(chunk.length);
        writable.write(chunk);
      }

      writable.end();
      await streamFinished(writable);
      const file = path.join(binFolder, info.filename);
      await fs.promises.rename(tmpFile, file);

      const zip = new async({ file });
      await zip.extract(null, binFolder);
      await zip.close();

      // Mark as executable
      await fs.promises.chmod(binPath, 493);

      // Delete downloaded file
      await fs.promises.rm(file);
    },
    { max: contentLen },
  );
}

async function withProgressBar<T>(
  fn: (tick: (n: number) => void) => Promise<T>,
  options: { max: number },
): Promise<T> {
  let current = 0;
  let start = Date.now();
  let passed = 0;
  let logged = false;

  const printStatus = throttle(() => {
    passed = Date.now() - start;

    const minutes = String(Math.floor(passed / 1000 / 60)).padStart(2, "0");
    const seconds = String(Math.floor(passed / 1000) % 60).padStart(2, "0");
    const time = `[${minutes}:${seconds}]`;
    const stats = `${humanFileSize(current)}/${humanFileSize(options.max)}`;

    const width = process.stdout.columns;

    let s = time;
    if (width - time.length - stats.length + 4 > 10) {
      const barLength = Math.min(width, 50);
      const percent = Math.floor((100 / options.max) * current);

      const bar = "#".repeat((barLength / 100) * percent) + ">";
      const remaining = styleText(
        "blue",
        "-".repeat(Math.max(barLength - bar.length, 0)),
      );
      s += ` [${styleText("cyan", bar)}${remaining}] `;
    }
    s += styleText("dim", stats);

    if (process.stdout.isTTY) {
      if (logged) {
        process.stdout.write("\r\x1b[K");
      }
      logged = true;
      process.stdout.write(s);
    }
  }, 16);

  const tick = (n: number) => {
    current += n;
    printStatus();
  };
  const res = await fn(tick);
  if (process.stdout.isTTY) {
    process.stdout.write("\n");
  } else {
    console.log("Download completed");
  }
  return res;
}

async function* streamToAsyncIterable<T>(
  stream: ReadableStream<T>,
): AsyncIterable<T> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

function humanFileSize(bytes: number, digits = 1): string {
  const thresh = 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + " B";
  }

  const units = ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
  let u = -1;
  const r = 10 ** digits;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return `${bytes.toFixed(digits)} ${units[u]}`;
}

function throttle(fn: () => void, delay: number): () => void {
  let timer: NodeJS.Timeout | null = null;

  return () => {
    if (timer === null) {
      fn();
      timer = setTimeout(() => {
        timer = null;
      }, delay);
    }
  };
}
