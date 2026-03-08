import { buildUpdateInstructions } from "./updateHints.mjs";
import { fetchLatestVersion, isNewerVersion } from "./versionInfo.mjs";

export async function buildUpdateMessage(options = {}) {
  const currentVersion = options.currentVersion;
  const packageManager = options.packageManager ?? "npm";
  const host = options.host ?? process.env.OPEN_PLAN_HOST;

  try {
    const latestVersion = await fetchLatestVersion();
    if (currentVersion && isNewerVersion(currentVersion, latestVersion)) {
      return `latest v${latestVersion}; ${buildUpdateInstructions({ host, packageManager, version: latestVersion })}`;
    }

    if (currentVersion) {
      return `latest v${latestVersion}; already up to date`;
    }

    return buildUpdateInstructions({ host, packageManager, version: latestVersion });
  } catch {
    return currentVersion
      ? `latest unknown; ${buildUpdateInstructions({ host, packageManager })}`
      : buildUpdateInstructions({ host, packageManager });
  }
}
