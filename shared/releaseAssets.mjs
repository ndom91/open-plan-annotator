const REPO = "ndom91/open-plan-annotator";

const PLATFORM_ASSET_BASENAME_MAP = {
  "darwin-arm64": "open-plan-annotator-darwin-arm64",
  "darwin-x64": "open-plan-annotator-darwin-x64",
  "linux-x64": "open-plan-annotator-linux-x64",
  "linux-arm64": "open-plan-annotator-linux-arm64",
};

function getPlatformKey(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`;
}

function getPlatformAssetArchiveName(platformKey = getPlatformKey()) {
  const assetBaseName = PLATFORM_ASSET_BASENAME_MAP[platformKey];
  if (!assetBaseName) {
    return null;
  }
  return `${assetBaseName}.tar.gz`;
}

function parseChecksumManifest(manifestText) {
  const checksums = new Map();

  for (const rawLine of manifestText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const bsdStyle = line.match(/^SHA256\s*\(([^)]+)\)\s*=\s*([a-fA-F0-9]{64})$/);
    if (bsdStyle) {
      checksums.set(bsdStyle[1].trim(), bsdStyle[2].toLowerCase());
      continue;
    }

    const gnuStyle = line.match(/^([a-fA-F0-9]{64})\s+[* ]?(.+)$/);
    if (gnuStyle) {
      checksums.set(gnuStyle[2].trim(), gnuStyle[1].toLowerCase());
    }
  }

  return checksums;
}

function selectChecksumAsset(assets) {
  const checksumAssets = assets
    .filter((asset) => {
      const lower = asset.name.toLowerCase();
      return (
        (lower.includes("sha256") || lower.includes("checksum")) &&
        (lower.endsWith(".txt") || lower.endsWith(".sha256") || lower.endsWith(".sha256sum") || lower.endsWith(".sha256sums"))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return checksumAssets[0] ?? null;
}

export {
  REPO,
  PLATFORM_ASSET_BASENAME_MAP,
  getPlatformKey,
  getPlatformAssetArchiveName,
  parseChecksumManifest,
  selectChecksumAsset,
};
