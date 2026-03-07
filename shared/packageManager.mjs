import path from "node:path";
import { fileURLToPath } from "node:url";

function detectFromValue(value) {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("pnpm")) return "pnpm";
  if (normalized.includes("yarn")) return "yarn";
  if (normalized.includes("bun")) return "bun";
  if (normalized.includes("npm")) return "npm";
  return undefined;
}

export function detectPackageManager(options = {}) {
  const env = options.env ?? process.env;
  const installPath = options.installPath;

  const explicit = detectFromValue(env.OPEN_PLAN_PKG_MANAGER);
  if (explicit) return explicit;

  const userAgent = env.npm_config_user_agent;
  if (typeof userAgent === "string") {
    const name = userAgent.split("/")[0];
    const detected = detectFromValue(name);
    if (detected) return detected;
  }

  const packageManager = detectFromValue(env.npm_package_manager);
  if (packageManager) return packageManager;

  const execPath = detectFromValue(env.npm_execpath);
  if (execPath) return execPath;

  const resolvedInstallPath = installPath ?? fileURLToPath(import.meta.url);
  const pathHint = detectFromValue(path.normalize(resolvedInstallPath));
  if (pathHint) return pathHint;

  return "npm";
}
