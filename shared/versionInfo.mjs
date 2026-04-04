const NPM_REGISTRY_BASE_URL = "https://registry.npmjs.org";

export function normalizeVersion(version) {
  return version.trim().replace(/^v/, "");
}

function parseSemver(version) {
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

function comparePrereleaseIdentifier(a, b) {
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

function compareSemver(a, b) {
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

export function isNewerVersion(current, latest) {
  const parsedCurrent = parseSemver(current);
  const parsedLatest = parseSemver(latest);
  if (!parsedCurrent || !parsedLatest) return false;
  return compareSemver(latest, current) > 0;
}

export async function fetchLatestVersion(packageName = "open-plan-annotator") {
  const url = `${NPM_REGISTRY_BASE_URL}/${encodeURIComponent(packageName)}/latest`;

  // Shell out to curl instead of using fetch/node:https — both hang inside
  // compiled bun binaries due to a DNS resolution bug.
  const { execFileSync } = await import("node:child_process");

  try {
    execFileSync("curl", ["--version"], { stdio: "ignore", timeout: 2_000 });
  } catch {
    throw new Error("curl not available, skipping update check");
  }

  const body = execFileSync("curl", ["-sf", "-H", "Accept: application/json", "-H", "User-Agent: open-plan-annotator-update-check", url], {
    timeout: 10_000,
    encoding: "utf8",
  });

  const payload = JSON.parse(body);
  if (!payload || typeof payload !== "object" || typeof payload.version !== "string") {
    throw new Error("npm registry response did not include a version string");
  }

  return normalizeVersion(payload.version);
}
