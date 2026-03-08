import { buildUpdateInstructions } from "../shared/updateHints.mjs";
import { fetchLatestVersion, isNewerVersion } from "../shared/versionInfo.mjs";
import type { UpdateInfo } from "./types.ts";
import { VERSION } from "./version.ts";

interface UpdateCache {
  latestVersion: string;
  checkedAt: number;
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const CACHE_FILENAME = "update-check.json";
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
      updateInstructions: buildUpdateInstructions({ packageManager, host: options?.host, version: latestVersion }),
    };
  } catch {
    return buildNoUpdateResult(packageManager, options?.host);
  }
}
