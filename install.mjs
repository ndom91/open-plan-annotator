#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import {
  PLATFORM_ASSET_BASENAME_MAP,
  REPO,
  getPlatformAssetArchiveName,
  getPlatformKey,
  parseChecksumManifest,
  selectChecksumAsset,
} from "./shared/releaseAssets.mjs";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

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

async function resolveReleaseAssetAndChecksum(options) {
  const opts = options || {};
  const fetchJsonImpl = opts.fetchJson || fetchJson;
  const fetchBuffer = opts.fetch || fetch;
  const releaseApiUrl = opts.releaseApiUrl || getReleaseApiUrl();
  const version = opts.version || VERSION;

  const release = await fetchJsonImpl(releaseApiUrl);
  const releaseAssets = Array.isArray(release.assets) ? release.assets : [];
  const key = opts.platformKey || getPlatformKey();
  const assetName = getPlatformAssetArchiveName(key);
  if (!assetName) {
    throw new Error(`Unsupported platform ${key}`);
  }

  const asset = releaseAssets.find((entry) => entry.name === assetName);
  if (!asset) {
    throw new Error(`Release v${version} is missing asset ${assetName}`);
  }

  const checksumAsset = selectChecksumAsset(releaseAssets);
  if (!checksumAsset) {
    throw new Error(`Release v${version} does not contain a checksum manifest asset`);
  }

  const checksumManifest = (await fetchBuffer(checksumAsset.browser_download_url)).toString("utf8");
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

function errorMessage(err) {
  return err && err.message ? err.message : String(err);
}

async function downloadVerifiedArchive(options) {
  const opts = options || {};
  const resolveRelease = opts.resolveReleaseAssetAndChecksum || resolveReleaseAssetAndChecksum;
  const fetchBuffer = opts.fetch || fetch;
  const checksumRequirement =
    "open-plan-annotator requires release checksum/sha256sum availability and will not install without verification.";

  let releaseInfo;

  try {
    releaseInfo = await resolveRelease();
  } catch (err) {
    throw new Error(`Unable to verify release checksums: ${errorMessage(err)} ${checksumRequirement}`);
  }

  const { assetName, assetUrl, expectedSha256 } = releaseInfo;
  const archiveBuffer = await fetchBuffer(assetUrl);
  const actualSha256 = sha256Hex(archiveBuffer);

  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Checksum verification failed for ${assetName} (expected ${expectedSha256}, got ${actualSha256}). ${checksumRequirement}`,
    );
  }

  return archiveBuffer;
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

  console.error(`Downloading open-plan-annotator for ${getPlatformKey()}...`);
  const archiveBuffer = await downloadVerifiedArchive();

  try {
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
    throw err;
  }
}

function shouldSkipInstall() {
  return Boolean(process.env.OPEN_PLAN_ANNOTATOR_SKIP_INSTALL || process.env.npm_config_dev);
}

function runCli() {
  if (shouldSkipInstall()) {
    process.exit(0);
  }

  main().catch((err) => {
    console.error("Failed to install open-plan-annotator binary:", err.message);
    console.error("You can try manually running: node", path.join(__dirname, "install.mjs"));
    process.exit(1);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}

export {
  VERSION,
  PLATFORM_ASSET_BASENAME_MAP as PLATFORM_MAP,
  getPlatformKey,
  getReleaseApiUrl,
  fetch,
  fetchJson,
  sha256Hex,
  parseChecksumManifest,
  selectChecksumAsset,
  resolveReleaseAssetAndChecksum,
  extractBinaryFromTarGz,
  downloadVerifiedArchive,
  shouldSkipInstall,
  main,
};
