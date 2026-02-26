import { accessSync, constants } from "node:fs";
import { VERSION } from "./version.ts";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  selfUpdatePossible: boolean;
  assetUrl: string | null;
  updateCommand: string;
}

interface UpdateCache {
  latestVersion: string;
  checkedAt: number;
  assetUrl: string | null;
}

interface GitHubRelease {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const CACHE_FILENAME = "update-check.json";
const REPO = "ndom91/open-plan-annotator";
const GITHUB_API = `https://api.github.com/repos/${REPO}/releases/latest`;

const PLATFORM_MAP: Record<string, string> = {
  "darwin-arm64": "open-plan-annotator-darwin-arm64",
  "darwin-x64": "open-plan-annotator-darwin-x64",
  "linux-x64": "open-plan-annotator-linux-x64",
  "linux-arm64": "open-plan-annotator-linux-arm64",
};

function getPlatformKey(): string {
  return `${process.platform}-${process.arch}`;
}

/** Returns true if `latest` is newer than `current` (semver: major.minor.patch). */
export function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [cMaj, cMin, cPat] = parse(current);
  const [lMaj, lMin, lPat] = parse(latest);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

function isBinaryWritable(): boolean {
  try {
    accessSync(process.execPath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function buildNoUpdateResult(packageManager: string): UpdateInfo {
  return {
    currentVersion: VERSION,
    latestVersion: null,
    updateAvailable: false,
    selfUpdatePossible: false,
    assetUrl: null,
    updateCommand: `${packageManager} update open-plan-annotator`,
  };
}

async function readCache(configDir: string): Promise<UpdateCache | null> {
  try {
    const raw = await Bun.file(`${configDir}/${CACHE_FILENAME}`).text();
    const parsed = JSON.parse(raw) as UpdateCache;
    if (typeof parsed.latestVersion === "string" && typeof parsed.checkedAt === "number") {
      return parsed;
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

async function fetchLatestRelease(): Promise<{ version: string; assetUrl: string | null }> {
  const res = await fetch(GITHUB_API, {
    headers: { "User-Agent": "open-plan-annotator-update", Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GitHub API responded with ${res.status}`);

  const data = (await res.json()) as GitHubRelease;
  const version = data.tag_name.replace(/^v/, "");

  const platformKey = getPlatformKey();
  const assetName = PLATFORM_MAP[platformKey];
  let assetUrl: string | null = null;
  if (assetName) {
    const asset = data.assets.find((a) => a.name === `${assetName}.tar.gz`);
    assetUrl = asset?.browser_download_url ?? null;
  }

  return { version, assetUrl };
}

export async function checkForUpdate(configDir: string, packageManager: string): Promise<UpdateInfo> {
  try {
    const cache = await readCache(configDir);
    const now = Date.now();

    let latestVersion: string;
    let assetUrl: string | null;

    if (cache && now - cache.checkedAt < CACHE_TTL_MS) {
      latestVersion = cache.latestVersion;
      assetUrl = cache.assetUrl;
    } else {
      const release = await fetchLatestRelease();
      latestVersion = release.version;
      assetUrl = release.assetUrl;
      await writeCache(configDir, { latestVersion, checkedAt: now, assetUrl }).catch(() => {});
    }

    const updateAvailable = isNewerVersion(VERSION, latestVersion);
    const selfUpdatePossible = updateAvailable && assetUrl !== null && isBinaryWritable();

    return {
      currentVersion: VERSION,
      latestVersion,
      updateAvailable,
      selfUpdatePossible,
      assetUrl: selfUpdatePossible ? assetUrl : null,
      updateCommand: `${packageManager} update open-plan-annotator`,
    };
  } catch {
    return buildNoUpdateResult(packageManager);
  }
}
