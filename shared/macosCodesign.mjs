import { execFileSync } from "node:child_process";

// `bun build --compile` appends the JS payload after the Mach-O is signed,
// which leaves the ad-hoc signature invalid. Recent macOS SIGKILLs such
// binaries on launch, so we verify and re-sign ad-hoc where needed.

/**
 * @param {string} binaryPath
 * @param {NodeJS.Platform} [platform]
 * @returns {boolean} true when the signature is valid (or the platform is not darwin)
 */
export function hasValidCodeSignature(binaryPath, platform = process.platform) {
  if (platform !== "darwin") return true;
  try {
    execFileSync("codesign", ["--verify", "--strict", binaryPath], { stdio: "ignore", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-sign the binary ad-hoc if its signature is invalid. Never throws.
 *
 * @param {string} binaryPath
 * @param {NodeJS.Platform} [platform]
 * @returns {boolean} true when the binary ends up with a valid signature
 */
export function ensureValidCodeSignature(binaryPath, platform = process.platform) {
  if (hasValidCodeSignature(binaryPath, platform)) return true;
  try {
    execFileSync("codesign", ["--force", "--sign", "-", binaryPath], { stdio: "ignore", timeout: 30_000 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`open-plan-annotator: failed to re-sign ${binaryPath}: ${message}\n`);
    return false;
  }
  process.stderr.write(`open-plan-annotator: re-signed ${binaryPath} (invalid macOS code signature)\n`);
  return hasValidCodeSignature(binaryPath, platform);
}

/**
 * Shell command a user can run to fix the signature by hand.
 *
 * @param {string} binaryPath
 * @returns {string}
 */
export function codesignFixCommand(binaryPath) {
  return `codesign --force --sign - "${binaryPath}"`;
}
