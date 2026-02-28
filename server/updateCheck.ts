import { accessSync, constants, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  getPlatformAssetArchiveName,
  getPlatformKey,
  parseChecksumManifest,
  REPO,
  selectChecksumAsset,
} from "../shared/releaseAssets.mjs";
import type { UpdateInfo } from "./types.ts";
import { VERSION } from "./version.ts";

export { parseChecksumManifest };

interface UpdateCache {
  latestVersion: string;
  checkedAt: number;
  assetUrl: string | null;
  assetSha256: string | null;
}

interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  draft: boolean;
  created_at?: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const CACHE_FILENAME = "update-check.json";
const GITHUB_RELEASES_API = `https://api.github.com/repos/${REPO}/releases`;
const RELEASES_PER_PAGE = 100;

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/, "");
}

function parseSemver(version: string): ParsedSemver | null {
  const normalized = normalizeVersion(version);
  const match = normalized.match(/^([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

function comparePrereleaseIdentifier(a: string, b: string): number {
  const aIsNum = /^[0-9]+$/.test(a);
  const bIsNum = /^[0-9]+$/.test(b);

  if (aIsNum && bIsNum) {
    const aNum = Number.parseInt(a, 10);
    const bNum = Number.parseInt(b, 10);
    return aNum === bNum ? 0 : aNum > bNum ? 1 : -1;
  }

  if (aIsNum) return -1;
  if (bIsNum) return 1;
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

function compareSemver(a: string, b: string): number {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  if (!parsedA || !parsedB) return 0;

  if (parsedA.major !== parsedB.major) return parsedA.major > parsedB.major ? 1 : -1;
  if (parsedA.minor !== parsedB.minor) return parsedA.minor > parsedB.minor ? 1 : -1;
  if (parsedA.patch !== parsedB.patch) return parsedA.patch > parsedB.patch ? 1 : -1;

  if (parsedA.prerelease.length === 0 && parsedB.prerelease.length === 0) return 0;
  if (parsedA.prerelease.length === 0) return 1;
  if (parsedB.prerelease.length === 0) return -1;

  const maxLen = Math.max(parsedA.prerelease.length, parsedB.prerelease.length);
  for (let i = 0; i < maxLen; i += 1) {
    const aPart = parsedA.prerelease[i];
    const bPart = parsedB.prerelease[i];
    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;
    const diff = comparePrereleaseIdentifier(aPart, bPart);
    if (diff !== 0) return diff;
  }

  return 0;
}

/** Returns true if `latest` is newer than `current` (full semver comparison). */
export function isNewerVersion(current: string, latest: string): boolean {
  const parsedCurrent = parseSemver(current);
  const parsedLatest = parseSemver(latest);
  if (!parsedCurrent || !parsedLatest) return false;
  return compareSemver(latest, current) > 0;
}

function canAtomicallyReplaceBinary(): boolean {
  const binaryPath = process.execPath;
  const binaryDir = dirname(binaryPath);
  const stamp = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const probeA = join(binaryDir, `.${basename(binaryPath)}.replace-probe-${stamp}`);
  const probeB = `${probeA}.renamed`;

  try {
    accessSync(binaryDir, constants.W_OK);
    writeFileSync(probeA, "", { mode: 0o600, flag: "wx" });
    renameSync(probeA, probeB);
    unlinkSync(probeB);
    return true;
  } catch {
    try {
      unlinkSync(probeA);
    } catch {
      // Probe may not have been created
    }
    try {
      unlinkSync(probeB);
    } catch {
      // Probe may not have been renamed
    }
    return false;
  }
}

function selectLatestStableRelease(releases: GitHubRelease[]): GitHubRelease | null {
  const stable = releases.filter((release) => {
    if (release.draft || release.prerelease) return false;
    return parseSemver(release.tag_name) !== null;
  });

  if (stable.length === 0) return null;

  stable.sort((a, b) => {
    const semverDiff = compareSemver(b.tag_name, a.tag_name);
    if (semverDiff !== 0) return semverDiff;

    const createdA = a.created_at ?? "";
    const createdB = b.created_at ?? "";
    if (createdA !== createdB) return createdB.localeCompare(createdA);

    return a.tag_name.localeCompare(b.tag_name);
  });

  return stable[0];
}

function buildNoUpdateResult(packageManager: string): UpdateInfo {
  return {
    currentVersion: VERSION,
    latestVersion: null,
    updateAvailable: false,
    selfUpdatePossible: false,
    assetUrl: null,
    assetSha256: null,
    updateCommand: `${packageManager} update open-plan-annotator`,
  };
}

async function readCache(configDir: string): Promise<UpdateCache | null> {
  try {
    const raw = await Bun.file(`${configDir}/${CACHE_FILENAME}`).text();
    const parsed = JSON.parse(raw) as UpdateCache;
    if (
      typeof parsed.latestVersion === "string" &&
      typeof parsed.checkedAt === "number" &&
      (typeof parsed.assetUrl === "string" || parsed.assetUrl === null) &&
      (typeof parsed.assetSha256 === "string" || parsed.assetSha256 === null || parsed.assetSha256 === undefined)
    ) {
      return {
        latestVersion: parsed.latestVersion,
        checkedAt: parsed.checkedAt,
        assetUrl: parsed.assetUrl,
        assetSha256: parsed.assetSha256 ?? null,
      };
    }
  } catch {
    // Missing or malformed cache
  }
  return null;
}

async function writeCache(configDir: string, cache: UpdateCache): Promise<void> {
  try {
    await Bun.write(`${configDir}/${CACHE_FILENAME}`, JSON.stringify(cache, null, 2));
  } catch {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(configDir, { recursive: true });
    await Bun.write(`${configDir}/${CACHE_FILENAME}`, JSON.stringify(cache, null, 2));
  }
}

async function fetchLatestRelease(): Promise<{ version: string; assetUrl: string | null; assetSha256: string | null }> {
  let page = 1;
  let release: GitHubRelease | null = null;

  while (!release) {
    const res = await fetch(`${GITHUB_RELEASES_API}?per_page=${RELEASES_PER_PAGE}&page=${page}`, {
      headers: { "User-Agent": "open-plan-annotator-update", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`GitHub API responded with ${res.status}`);

    const releases = (await res.json()) as GitHubRelease[];
    if (releases.length === 0) break;

    release = selectLatestStableRelease(releases);
    if (release) break;

    if (releases.length < RELEASES_PER_PAGE) break;
    page += 1;
  }

  if (!release) throw new Error("No stable releases found");

  const version = normalizeVersion(release.tag_name);

  const platformKey = getPlatformKey();
  const expectedAssetName = getPlatformAssetArchiveName(platformKey);
  let assetUrl: string | null = null;
  let assetSha256: string | null = null;

  if (expectedAssetName) {
    const asset = release.assets.find((a) => a.name === expectedAssetName);
    assetUrl = asset?.browser_download_url ?? null;

    if (asset) {
      const checksumAsset = selectChecksumAsset(release.assets);
      if (checksumAsset) {
        const checksumRes = await fetch(checksumAsset.browser_download_url, {
          headers: { "User-Agent": "open-plan-annotator-update", Accept: "text/plain" },
          signal: AbortSignal.timeout(10_000),
        });
        if (checksumRes.ok) {
          const checksums = parseChecksumManifest(await checksumRes.text());
          assetSha256 = checksums.get(expectedAssetName) ?? null;
        }
      }
    }
  }

  return { version, assetUrl, assetSha256 };
}

export async function checkForUpdate(
  configDir: string,
  packageManager: string,
  options?: { skipCache?: boolean },
): Promise<UpdateInfo> {
  try {
    const cache = options?.skipCache ? null : await readCache(configDir);
    const now = Date.now();

    let latestVersion: string;
    let assetUrl: string | null;
    let assetSha256: string | null;

    if (cache && now - cache.checkedAt < CACHE_TTL_MS) {
      latestVersion = cache.latestVersion;
      assetUrl = cache.assetUrl;
      assetSha256 = cache.assetSha256 ?? null;
    } else {
      const release = await fetchLatestRelease();
      latestVersion = release.version;
      assetUrl = release.assetUrl;
      assetSha256 = release.assetSha256;
      await writeCache(configDir, { latestVersion, checkedAt: now, assetUrl, assetSha256 }).catch(() => {});
    }

    const updateAvailable = isNewerVersion(VERSION, latestVersion);
    const selfUpdatePossible =
      updateAvailable && assetUrl !== null && assetSha256 !== null && canAtomicallyReplaceBinary();

    return {
      currentVersion: VERSION,
      latestVersion,
      updateAvailable,
      selfUpdatePossible,
      assetUrl: selfUpdatePossible ? assetUrl : null,
      assetSha256: selfUpdatePossible ? assetSha256 : null,
      updateCommand: `${packageManager} update open-plan-annotator`,
    };
  } catch {
    return buildNoUpdateResult(packageManager);
  }
}
