import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
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
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const packageName = getRuntimePackageName(platform, arch);

  if (!packageName) {
    throw new Error(`Unsupported platform ${getRuntimePlatformKey(platform, arch)}`);
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
        packageName,
        packageRoot: path.dirname(path.dirname(workspaceBinaryPath)),
        binaryPath: workspaceBinaryPath,
      };
    }

    throw new Error(
      `Missing runtime package ${packageName}. Reinstall open-plan-annotator for ${getRuntimePlatformKey(platform, arch)}.`,
    );
  }

  const packageRoot = path.dirname(packageJsonPath);
  const binaryPath = path.join(packageRoot, "bin", "open-plan-annotator");

  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Runtime package ${packageName} is installed but ${binaryPath} is missing. Rebuild or reinstall it.`);
  }

  return {
    packageName,
    packageRoot,
    binaryPath,
  };
}
