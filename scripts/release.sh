#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# --- Read current version ---
CURRENT=$(node -p "require('./package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

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
  *) echo "Invalid choice"; exit 1 ;;
esac

echo ""
echo "Bumping $CURRENT → $NEW_VERSION"
echo ""

# --- Update version in package.json and plugin.json ---
npm version "$NEW_VERSION" --no-git-tag-version
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('plugin/plugin.json', 'utf8'));
  p.version = '$NEW_VERSION';
  fs.writeFileSync('plugin/plugin.json', JSON.stringify(p, null, 2) + '\n');
"

# --- Build ---
echo "Building UI..."
bun run build:ui

echo "Cross-compiling binaries..."
node scripts/build-platforms.cjs

echo "Creating tarballs..."
node scripts/tarball.cjs

# --- Git tag + commit ---
git add package.json plugin/plugin.json
git commit -m "v$NEW_VERSION"
git tag "v$NEW_VERSION"

# --- Push ---
echo ""
read -rp "Push to origin and publish? [y/N]: " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted. Commit and tag are local — run 'git push --follow-tags' when ready."
  exit 0
fi

git push --follow-tags

# --- GitHub Release ---
echo "Creating GitHub Release..."
gh release create "v$NEW_VERSION" dist/*.tar.gz --title "v$NEW_VERSION" --generate-notes

# --- npm publish ---
echo "Publishing to npm..."
npm publish

echo ""
echo "Done! Released v$NEW_VERSION"
