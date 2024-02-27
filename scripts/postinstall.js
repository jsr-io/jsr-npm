const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const util = require("node:util");
const stream = require("node:stream");
const kl = require("kolorist");
const StreamZip = require("node-stream-zip");

const streamFinished = util.promisify(stream.finished);

const DENO_CANARY_INFO_URL =
  "https://storage.googleapis.com/dl.deno.land/canary-latest.txt";

// Example: https://github.com/denoland/deno/releases/download/v1.41.0/deno-aarch64-apple-darwin.zip
// Example: https://dl.deno.land/canary/d722de886b85093eeef08d1e9fd6f3193405762d/deno-aarch64-apple-darwin.zip
/** @type {Record<string, string>} */
const FILENAMES = {
  "darwin arm64": "deno-aarch64-apple-darwin",
  "darwin x64": "deno-x86_64-apple-darwin",
  "linux arm64": "deno-aarch64-unknown-linux-gnu",
  "linux x64": "deno-x86_64-unknown-linux-gnu",
  "win32 x64": "deno-x86_64-pc-windows-msvc",
};

/** @returns {Promise<{url: string, filename: string}>} */
async function getDenoDownloadUrl() {
  const key = `${process.platform} ${os.arch()}`;
  if (!(key in FILENAMES)) {
    throw new Error(`Unsupported platform: ${key}`);
  }

  const name = FILENAMES[key];

  const res = await fetch(DENO_CANARY_INFO_URL);
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(
      `${res.status}: Unable to retrieve canary version information from ${DENO_CANARY_INFO_URL}.`
    );
  }
  const sha = (await res.text()).trim();

  const filename = name + ".zip";
  return {
    url: `https://dl.deno.land/canary/${decodeURI(sha)}/${filename}`,
    filename,
  };
}

(async () => {
  const info = await getDenoDownloadUrl();

  const targetPath = path.join(__dirname, "..", ".download");
  await fs.promises.mkdir(targetPath, { recursive: true });

  const res = await fetch(info.url);
  const contentLen = Number(res.headers.get("content-length") ?? Infinity);
  if (res.body == null) {
    throw new Error(`Unexpected empty body`);
  }

  console.log(`Downloading JSR binary...`);

  await withProgressBar(
    async (tick) => {
      const tmpFile = path.join(targetPath, info.filename + ".part");
      const writable = fs.createWriteStream(tmpFile, "utf-8");

      for await (const chunk of streamToAsyncIterable(res.body)) {
        tick(chunk.length);
        writable.write(chunk);
      }

      writable.end();
      await streamFinished(writable);
      const file = path.join(targetPath, info.filename);
      await fs.promises.rename(tmpFile, file);

      const zip = new StreamZip.async({ file });
      await zip.extract(null, targetPath);
      await zip.close();

      const deno = path.join(
        targetPath,
        process.platform === "win32" ? "deno.exe" : "deno"
      );
      await fs.promises.chmod(deno, 493);

      // Delete downloaded file
      await fs.promises.rm(file);
    },
    { max: contentLen }
  );
})();

/** @type {<T>(fn: (tick: (n: number) => void) => Promise<T>, options: {max: number}) => Promise<T>} */
async function withProgressBar(fn, options) {
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
      const remaining = kl.blue(
        "-".repeat(Math.max(barLength - bar.length, 0))
      );
      s += ` [${kl.cyan(bar)}${remaining}] `;
    }
    s += kl.dim(stats);

    if (process.stdout.isTTY) {
      if (logged) {
        process.stdout.write("\r\x1b[K");
      }
      logged = true;
      process.stdout.write(s);
    }
  }, 16);

  /** @type {(n: number) => void} */
  const tick = (n) => {
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

/** @type {<T>(stream: ReadableStream<T>) => AsyncIterable<T>} */
async function* streamToAsyncIterable(stream) {
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

/** @type {(bytes: number, digists?: number) => string} */
function humanFileSize(bytes, digits = 1) {
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

/** @type {(fn: () => void, delay: number) => () => void} */
function throttle(fn, delay) {
  let timer = null;

  return () => {
    if (timer === null) {
      fn();
      timer = setTimeout(() => {
        timer = null;
      }, delay);
    }
  };
}
