import { buildUpdateInstructions } from "../shared/updateHints.mjs";
import type { UpdateInfo } from "./types.ts";
import { VERSION } from "./version.ts";

interface UpdateCache {
  latestVersion: string;
  checkedAt: number;
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const CACHE_FILENAME = "update-check.json";
const NPM_LATEST_URL = "https://registry.npmjs.org/open-plan-annotator/latest";

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

export function isNewerVersion(current: string, latest: string): boolean {
  const parsedCurrent = parseSemver(current);
  const parsedLatest = parseSemver(latest);
  if (!parsedCurrent || !parsedLatest) return false;
  return compareSemver(latest, current) > 0;
}

function buildNoUpdateResult(packageManager: string, host?: string): UpdateInfo {
  return {
    currentVersion: VERSION,
    latestVersion: null,
    updateAvailable: false,
    updateInstructions: buildUpdateInstructions({ packageManager, host }),
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
    // Missing or malformed cache.
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

async function fetchLatestVersion(): Promise<string> {
  const response = await fetch(NPM_LATEST_URL, {
    headers: { "User-Agent": "open-plan-annotator-update-check", Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`npm registry responded with ${response.status}`);
  }

  const payload = (await response.json()) as { version?: unknown };
  if (typeof payload.version !== "string") {
    throw new Error("npm registry response did not include a version string");
  }

  return normalizeVersion(payload.version);
}

export async function checkForUpdate(
  configDir: string,
  packageManager: string,
  options?: { skipCache?: boolean; host?: string },
): Promise<UpdateInfo> {
  try {
    const cache = options?.skipCache ? null : await readCache(configDir);
    const now = Date.now();

    let latestVersion: string;
    if (cache && now - cache.checkedAt < CACHE_TTL_MS) {
      latestVersion = cache.latestVersion;
    } else {
      latestVersion = await fetchLatestVersion();
      await writeCache(configDir, { latestVersion, checkedAt: now }).catch(() => {});
    }

    return {
      currentVersion: VERSION,
      latestVersion,
      updateAvailable: isNewerVersion(VERSION, latestVersion),
      updateInstructions: buildUpdateInstructions({ packageManager, host: options?.host }),
    };
  } catch {
    return buildNoUpdateResult(packageManager, options?.host);
  }
}
