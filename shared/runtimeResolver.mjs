import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RUNTIME_PACKAGE_MAP = {
  "darwin-arm64": "@open-plan-annotator/runtime-darwin-arm64",
  "darwin-x64": "@open-plan-annotator/runtime-darwin-x64",
  "linux-arm64": "@open-plan-annotator/runtime-linux-arm64",
  "linux-x64": "@open-plan-annotator/runtime-linux-x64",
};

export function getRuntimePlatformKey(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`;
}

export function getRuntimePackageName(platform = process.platform, arch = process.arch) {
  return RUNTIME_PACKAGE_MAP[getRuntimePlatformKey(platform, arch)];
}

export function resolveRuntimeBinary(options = {}) {
  const attempt = () => tryResolveRuntimeBinary(options);

  const first = attempt();
  if (first.ok) return first.value;

  // Skip installer for hard-failure conditions (unsupported platform): no
  // amount of installing will produce a binary, and we'd waste a network
  // round trip downloading the host's binary unnecessarily.
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  if (!getRuntimePackageName(platform, arch)) {
    throw first.error;
  }

  // Last-resort recovery: invoke the SessionStart installer synchronously and
  // retry resolution once. Useful for hosts that fetch this package without
  // running `npm install` (and therefore skip the optionalDependencies that
  // would otherwise pull the matching runtime binary). The Claude Code plugin
  // install path is the canonical example, but it triggers the same script
  // earlier via its SessionStart hook; this branch covers everyone else.
  if (runInstaller(options)) {
    const second = attempt();
    if (second.ok) return second.value;
    throw second.error;
  }

  throw first.error;
}

function tryResolveRuntimeBinary(options = {}) {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const packageName = getRuntimePackageName(platform, arch);

  if (!packageName) {
    return {
      ok: false,
      error: new Error(`Unsupported platform ${getRuntimePlatformKey(platform, arch)}`),
    };
  }

  const requireFrom = createRequire(options.parentUrl ?? import.meta.url);
  const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  let packageJsonPath;
  try {
    packageJsonPath = requireFrom.resolve(`${packageName}/package.json`);
  } catch {
    const workspaceBinaryPath = path.join(workspaceRoot, "packages", packageName.split("/").at(-1) ?? "", "bin", "open-plan-annotator");
    if (fs.existsSync(workspaceBinaryPath)) {
      return {
        ok: true,
        value: {
          packageName,
          packageRoot: path.dirname(path.dirname(workspaceBinaryPath)),
          binaryPath: workspaceBinaryPath,
        },
      };
    }

    return {
      ok: false,
      error: new Error(
        `Missing runtime package ${packageName}. Reinstall open-plan-annotator for ${getRuntimePlatformKey(platform, arch)}.`,
      ),
    };
  }

  const packageRoot = path.dirname(packageJsonPath);
  const binaryPath = path.join(packageRoot, "bin", "open-plan-annotator");

  if (!fs.existsSync(binaryPath)) {
    return {
      ok: false,
      error: new Error(`Runtime package ${packageName} is installed but ${binaryPath} is missing. Rebuild or reinstall it.`),
    };
  }

  return {
    ok: true,
    value: {
      packageName,
      packageRoot,
      binaryPath,
    },
  };
}

/**
 * Run `scripts/install-runtime.mjs` synchronously to lay down the per-platform
 * runtime binary. Returns true if the installer ran successfully, false if it
 * was unavailable or failed. Diagnostics go to stderr; this function never
 * throws so a failure here falls through to the original missing-runtime
 * error from the caller.
 */
function runInstaller(_options = {}) {
  // Opt-out for callers that want to keep the old behavior (e.g. tests that
  // assert the error path) or environments where re-entry would be harmful.
  if (process.env.OPEN_PLAN_ANNOTATOR_SKIP_INSTALL === "1") return false;

  const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const installerPath = path.join(workspaceRoot, "scripts", "install-runtime.mjs");
  if (!fs.existsSync(installerPath)) return false;

  try {
    execFileSync(process.execPath, [installerPath], {
      stdio: ["ignore", "ignore", "inherit"],
      timeout: 60_000,
    });
    return true;
  } catch {
    return false;
  }
}
