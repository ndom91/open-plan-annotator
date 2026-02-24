#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const https = require("https");

const VERSION = require("./package.json").version;
const REPO = "ndomino/open-plan-annotator";

const PLATFORM_MAP = {
  "darwin-arm64": "open-plan-annotator-darwin-arm64",
  "darwin-x64": "open-plan-annotator-darwin-x64",
  "linux-x64": "open-plan-annotator-linux-x64",
  "linux-arm64": "open-plan-annotator-linux-arm64",
};

function getPlatformKey() {
  return `${process.platform}-${process.arch}`;
}

function getDownloadUrl() {
  const key = getPlatformKey();
  const asset = PLATFORM_MAP[key];
  if (!asset) {
    console.error(`open-plan-annotator: unsupported platform ${key}`);
    console.error(`Supported: ${Object.keys(PLATFORM_MAP).join(", ")}`);
    process.exit(1);
  }
  return `https://github.com/${REPO}/releases/download/v${VERSION}/${asset}.tar.gz`;
}

function fetch(url, redirects) {
  if (redirects === undefined) redirects = 5;
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "open-plan-annotator-install" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirects <= 0) return reject(new Error("Too many redirects"));
          return fetch(res.headers.location, redirects - 1).then(resolve, reject);
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

function extractBinaryFromTarGz(buffer) {
  const tarBuffer = zlib.gunzipSync(buffer);
  let offset = 0;

  while (offset < tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    offset += 512;

    const name = header.toString("utf-8", 0, 100).replace(/\0.*/g, "");
    const sizeStr = header.toString("utf-8", 124, 136).replace(/\0.*/g, "").trim();
    const size = parseInt(sizeStr, 8);

    if (!name || isNaN(size)) break;

    if (name === "open-plan-annotator" || name.endsWith("/open-plan-annotator")) {
      return tarBuffer.subarray(offset, offset + size);
    }

    offset += Math.ceil(size / 512) * 512;
  }

  throw new Error("Binary 'open-plan-annotator' not found in archive");
}

async function main() {
  const destDir = path.join(__dirname, "bin");
  const destPath = path.join(destDir, "open-plan-annotator");

  // Skip if binary already exists
  if (fs.existsSync(destPath)) {
    return;
  }

  const url = getDownloadUrl();
  console.log(`Downloading open-plan-annotator for ${getPlatformKey()}...`);

  const buffer = await fetch(url);
  const binaryBuffer = extractBinaryFromTarGz(buffer);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.writeFileSync(destPath, binaryBuffer, { mode: 0o755 });
  console.log(`Installed open-plan-annotator to ${destPath}`);
}

main().catch((err) => {
  console.error("Failed to install open-plan-annotator binary:", err.message);
  console.error("You can try manually running: node", path.join(__dirname, "install.cjs"));
  process.exit(1);
});
