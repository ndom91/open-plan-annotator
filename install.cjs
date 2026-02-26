#!/usr/bin/env node

// Skip postinstall during local development
if (process.env.OPEN_PLAN_ANNOTATOR_SKIP_INSTALL || process.env.npm_config_dev) {
  process.exit(0);
}

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const https = require("https");
const crypto = require("crypto");

const VERSION = require("./package.json").version;
const REPO = "ndom91/open-plan-annotator";

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

function getReleaseApiUrl() {
  return `https://api.github.com/repos/${REPO}/releases/tags/v${VERSION}`;
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

async function fetchJson(url) {
  const buffer = await fetch(url);
  return JSON.parse(buffer.toString("utf8"));
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function parseChecksumManifest(manifestText) {
  const checksums = new Map();

  for (const rawLine of manifestText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const bsdStyle = line.match(/^SHA256\s*\(([^)]+)\)\s*=\s*([a-fA-F0-9]{64})$/);
    if (bsdStyle) {
      checksums.set(bsdStyle[1].trim(), bsdStyle[2].toLowerCase());
      continue;
    }

    const gnuStyle = line.match(/^([a-fA-F0-9]{64})\s+[* ]?(.+)$/);
    if (gnuStyle) {
      checksums.set(gnuStyle[2].trim(), gnuStyle[1].toLowerCase());
    }
  }

  return checksums;
}

function selectChecksumAsset(assets) {
  const checksumAssets = assets
    .filter((asset) => {
      const lower = asset.name.toLowerCase();
      return (
        (lower.includes("sha256") || lower.includes("checksum")) &&
        (lower.endsWith(".txt") || lower.endsWith(".sha256") || lower.endsWith(".sha256sum") || lower.endsWith(".sha256sums"))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return checksumAssets[0] || null;
}

async function resolveReleaseAssetAndChecksum() {
  const release = await fetchJson(getReleaseApiUrl());
  const releaseAssets = Array.isArray(release.assets) ? release.assets : [];
  const key = getPlatformKey();
  const assetBaseName = PLATFORM_MAP[key];
  if (!assetBaseName) {
    throw new Error(`Unsupported platform ${key}`);
  }

  const assetName = `${assetBaseName}.tar.gz`;
  const asset = releaseAssets.find((entry) => entry.name === assetName);
  if (!asset) {
    throw new Error(`Release v${VERSION} is missing asset ${assetName}`);
  }

  const checksumAsset = selectChecksumAsset(releaseAssets);
  if (!checksumAsset) {
    throw new Error(`Release v${VERSION} does not contain a checksum manifest asset`);
  }

  const checksumManifest = (await fetch(checksumAsset.browser_download_url)).toString("utf8");
  const checksums = parseChecksumManifest(checksumManifest);
  const expectedSha256 = checksums.get(assetName);
  if (!expectedSha256) {
    throw new Error(`Checksum manifest does not contain ${assetName}`);
  }

  return {
    assetName,
    assetUrl: asset.browser_download_url,
    expectedSha256,
  };
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
  const destPath = path.join(destDir, "open-plan-annotator-binary");
  const tempPath = `${destPath}.tmp-${process.pid}-${Date.now()}`;

  // Skip if binary already exists
  if (fs.existsSync(destPath)) {
    return;
  }

  const fallbackUrl = getDownloadUrl();
  console.error(`Downloading open-plan-annotator for ${getPlatformKey()}...`);

  try {
    const { assetName, assetUrl, expectedSha256 } = await resolveReleaseAssetAndChecksum();
    const archiveBuffer = await fetch(assetUrl);
    const actualSha256 = sha256Hex(archiveBuffer);

    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `Checksum verification failed for ${assetName} (expected ${expectedSha256}, got ${actualSha256})`,
      );
    }

    const binaryBuffer = extractBinaryFromTarGz(archiveBuffer);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.writeFileSync(tempPath, binaryBuffer, { mode: 0o755 });
    fs.renameSync(tempPath, destPath);
    fs.chmodSync(destPath, 0o755);
    console.error(`Installed open-plan-annotator to ${destPath}`);
  } catch (err) {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Temp file may not exist
    }

    const message = err && err.message ? err.message : String(err);
    console.error(`open-plan-annotator: install failed: ${message}`);
    console.error(`Fallback URL for diagnostics: ${fallbackUrl}`);
    throw err;
  }
}

main().catch((err) => {
  console.error("Failed to install open-plan-annotator binary:", err.message);
  console.error("You can try manually running: node", path.join(__dirname, "install.cjs"));
  process.exit(1);
});
