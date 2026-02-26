import { performSelfUpdate } from "./selfUpdate.ts";
import { checkForUpdate, type UpdateInfo } from "./updateCheck.ts";
import { VERSION } from "./version.ts";

export async function runCliUpdate(): Promise<void> {
  const configBase = process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`;
  const configDir = `${configBase}/open-plan-annotator`;
  const packageManager = process.env.OPEN_PLAN_PKG_MANAGER || "npm";

  let info: UpdateInfo;
  try {
    info = await checkForUpdate(configDir, packageManager);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to check for updates: ${message}`);
    process.exit(1);
  }

  if (!info.updateAvailable) {
    console.log(`Already up to date (v${VERSION})`);
    process.exit(0);
  }

  console.log(`Update available: v${info.currentVersion} → v${info.latestVersion}`);

  if (!info.selfUpdatePossible || !info.assetUrl || !info.assetSha256) {
    console.log(`Self-update is not possible (binary directory may not be writable).`);
    console.log(`Run: ${info.updateCommand}`);
    process.exit(1);
  }

  console.log("Downloading...");

  try {
    await performSelfUpdate(info.assetUrl, info.assetSha256);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Update failed: ${message}`);
    process.exit(1);
  }

  console.log(`Updated v${info.currentVersion} → v${info.latestVersion}`);
  process.exit(0);
}
