#!/usr/bin/env node
// Installs the per-platform Bun-compiled runtime binary for open-plan-annotator
// from the npm registry. Intended to run as a Claude Code SessionStart hook.
//
// Behavior:
//   1. Determines plugin version from the sibling package.json.
//   2. Picks the runtime package matching the host platform/arch.
//   3. If the target binary already exists at the resolver's fallback path
//      (`packages/runtime-<platform>-<arch>/bin/open-plan-annotator`) AND its
//      `--version` matches the plugin version, exits 0. A version mismatch
//      (stale binary left from a prior version) falls through to reinstall.
//   4. Otherwise fetches the package manifest from the npm registry,
//      downloads the tarball, verifies its integrity against `dist.integrity`,
//      extracts it via system `tar`, and atomically moves the binary into place.
//
// Logs go to stderr only — stdout is reserved for hook protocol output.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { get as httpsGet } from "node:https";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_PLATFORMS = new Set([
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
]);

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");

const pkg = JSON.parse(readFileSync(join(pluginRoot, "package.json"), "utf8"));
const version = pkg.version;

const platformKey = `${process.platform}-${process.arch}`;
if (!SUPPORTED_PLATFORMS.has(platformKey)) {
  process.stderr.write(
    `open-plan-annotator: unsupported platform ${platformKey}. Supported: ${[...SUPPORTED_PLATFORMS].join(", ")}\n`,
  );
  process.exit(1);
}

const runtimePackage = `@open-plan-annotator/runtime-${platformKey}`;
const targetDir = join(pluginRoot, "packages", `runtime-${platformKey}`, "bin");
const targetBinary = join(targetDir, "open-plan-annotator");

if (existsSync(targetBinary)) {
  // Fast path: skip the download only when the installed binary's version
  // matches the plugin version. Checking existence alone is not enough — a
  // stale binary from a previous plugin version can be left in place when a
  // new version dir is created (e.g. copied install trees), which would pin
  // the runtime to the old version forever. Re-probe and reinstall on drift.
  const installedVersion = readBinaryVersion(targetBinary);
  if (installedVersion === version) {
    process.exit(0);
  }
  process.stderr.write(
    `open-plan-annotator: installed runtime is ${installedVersion ?? "unknown"}, expected ${version}; reinstalling…\n`,
  );
}

process.stderr.write(
  `open-plan-annotator: installing runtime ${runtimePackage}@${version} for ${platformKey}…\n`,
);

const start = Date.now();

try {
  const manifest = await fetchJson(
    `https://registry.npmjs.org/${encodeURIComponent(runtimePackage)}/${encodeURIComponent(version)}`,
  );

  const tarballUrl = manifest?.dist?.tarball;
  const integrity = manifest?.dist?.integrity;
  if (typeof tarballUrl !== "string" || typeof integrity !== "string") {
    throw new Error(
      `npm manifest for ${runtimePackage}@${version} missing dist.tarball or dist.integrity`,
    );
  }

  const tarballBuf = await fetchBuffer(tarballUrl);
  verifyIntegrity(tarballBuf, integrity, runtimePackage, version);

  const tmp = mkdtempSync(join(tmpdir(), "opa-runtime-"));
  try {
    const tarPath = join(tmp, "runtime.tgz");
    writeFileSync(tarPath, tarballBuf);
    execFileSync("tar", ["-xzf", tarPath, "-C", tmp], { stdio: "ignore" });

    // npm tarballs always extract to a `package/` directory.
    const extractedBinary = join(tmp, "package", "bin", "open-plan-annotator");
    if (!existsSync(extractedBinary)) {
      throw new Error(
        `expected ${extractedBinary} after extracting ${runtimePackage}@${version}, not found`,
      );
    }

    mkdirSync(targetDir, { recursive: true });
    // renameSync may fail across filesystems; tmpdir is usually on the same
    // device as the plugin cache, but if not, fall back to copy+unlink.
    try {
      renameSync(extractedBinary, targetBinary);
    } catch (err) {
      if (err?.code === "EXDEV") {
        const buf = readFileSync(extractedBinary);
        writeFileSync(targetBinary, buf);
      } else {
        throw err;
      }
    }
    chmodSync(targetBinary, 0o755);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const elapsedMs = Date.now() - start;
  process.stderr.write(
    `open-plan-annotator: installed ${targetBinary} (${elapsedMs}ms)\n`,
  );
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(
    `open-plan-annotator: failed to install runtime ${runtimePackage}@${version}: ${message}\n`,
  );
  process.stderr.write(
    `open-plan-annotator: rerun a Claude Code session to retry; ExitPlanMode will not work until install succeeds.\n`,
  );
  process.exit(1);
}

/**
 * Probe an installed runtime binary for its version string.
 *
 * Runs `<binary> --version` and returns the trimmed stdout, or null if the
 * binary can't be executed or doesn't respond (treated as stale → reinstall).
 *
 * @param {string} binaryPath
 * @returns {string | null}
 */
function readBinaryVersion(binaryPath) {
  try {
    const out = execFileSync(binaryPath, ["--version"], {
      timeout: 5_000,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Fetch a URL with redirect handling and return the response buffer.
 *
 * @param {string} url
 * @param {number} [maxRedirects]
 * @returns {Promise<Buffer>}
 */
function fetchBuffer(url, maxRedirects = 5) {
  return new Promise((resolveFetch, rejectFetch) => {
    httpsGet(
      url,
      {
        headers: {
          "user-agent": `open-plan-annotator-installer/${version}`,
          accept: "*/*",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if ((status === 301 || status === 302 || status === 307 || status === 308) && res.headers.location) {
          if (maxRedirects <= 0) {
            rejectFetch(new Error(`too many redirects for ${url}`));
            res.resume();
            return;
          }
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          fetchBuffer(next, maxRedirects - 1).then(resolveFetch, rejectFetch);
          return;
        }
        if (status !== 200) {
          rejectFetch(new Error(`GET ${url} -> HTTP ${status}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolveFetch(Buffer.concat(chunks)));
        res.on("error", rejectFetch);
      },
    ).on("error", rejectFetch);
  });
}

/**
 * @param {string} url
 * @returns {Promise<unknown>}
 */
async function fetchJson(url) {
  const buf = await fetchBuffer(url);
  return JSON.parse(buf.toString("utf8"));
}

/**
 * Verify a buffer against an npm Subresource Integrity string (e.g. "sha512-…").
 *
 * @param {Buffer} buf
 * @param {string} integrity
 * @param {string} pkgName
 * @param {string} pkgVersion
 */
function verifyIntegrity(buf, integrity, pkgName, pkgVersion) {
  const match = integrity.match(/^(sha\d+)-([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error(
      `unrecognized integrity format "${integrity}" for ${pkgName}@${pkgVersion}`,
    );
  }
  const [, algo, expectedB64] = match;
  const actualB64 = createHash(algo).update(buf).digest("base64");
  if (actualB64 !== expectedB64) {
    throw new Error(
      `integrity mismatch for ${pkgName}@${pkgVersion}\n  expected ${algo}: ${expectedB64}\n  actual   ${algo}: ${actualB64}`,
    );
  }
}
