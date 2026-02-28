#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# --- Read current version ---
CURRENT=$(node -p "require('./package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<<"$CURRENT"

echo "Current version: $CURRENT"
echo ""
echo "Bump type:"
echo "  1) patch  → $MAJOR.$MINOR.$((PATCH + 1))"
echo "  2) minor  → $MAJOR.$((MINOR + 1)).0"
echo "  3) major  → $((MAJOR + 1)).0.0"
echo ""
read -rp "Choose [1/2/3]: " CHOICE

case "$CHOICE" in
1) NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
2) NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
3) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
*)
  echo "Invalid choice"
  exit 1
  ;;
esac

echo ""
echo "Bumping $CURRENT → $NEW_VERSION"
echo ""

# --- Update version in package.json, plugin.json, and marketplace.json ---
# NOTE: We intentionally use npm for version/publish because this package is
# published to the npm registry and these commands provide canonical npm
# lifecycle + semver behavior for release metadata.
npm version "$NEW_VERSION" --no-git-tag-version
node -e "
  const fs = require('fs');

  const plugin = JSON.parse(fs.readFileSync('.claude-plugin/plugin.json', 'utf8'));
  plugin.version = '$NEW_VERSION';
  fs.writeFileSync('.claude-plugin/plugin.json', JSON.stringify(plugin, null, 2) + '\n');

  const market = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf8'));
  if (market.metadata && typeof market.metadata === 'object') {
    market.metadata.version = '$NEW_VERSION';
  }
  for (const p of market.plugins) { p.version = '$NEW_VERSION'; }
  fs.writeFileSync('.claude-plugin/marketplace.json', JSON.stringify(market, null, 2) + '\n');
"

# --- Build ---
echo "Building UI..."
bun run build:ui

echo "Cross-compiling binaries..."
node scripts/build-platforms.mjs

echo "Creating tarballs..."
node scripts/tarball.mjs

# --- Git tag + commit ---
echo ""
git add package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "v$NEW_VERSION"
git tag -m "v$NEW_VERSION" "v$NEW_VERSION"

# --- Push ---
echo ""
git push --follow-tags

# --- GitHub Release ---
echo "Creating GitHub Release..."
gh release create "v$NEW_VERSION" dist/*.tar.gz dist/sha256sums.txt --title "v$NEW_VERSION" --generate-notes

# --- npm publish ---
echo "Publishing to npm..."
npm publish

echo ""
echo "Done! Released v$NEW_VERSION"
