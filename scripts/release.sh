#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RUNTIME_PACKAGES=(
  "packages/runtime-darwin-arm64"
  "packages/runtime-darwin-x64"
  "packages/runtime-linux-arm64"
  "packages/runtime-linux-x64"
)
PI_PACKAGES=(
  "packages/pi-extension"
)

# --- Read current version ---
CURRENT=$(bun pm pkg get version | tr -d '"')
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

# --- Update versions ---
bun pm pkg set \
  "version=$NEW_VERSION" \
  "optionalDependencies.@open-plan-annotator/runtime-darwin-arm64=$NEW_VERSION" \
  "optionalDependencies.@open-plan-annotator/runtime-darwin-x64=$NEW_VERSION" \
  "optionalDependencies.@open-plan-annotator/runtime-linux-arm64=$NEW_VERSION" \
  "optionalDependencies.@open-plan-annotator/runtime-linux-x64=$NEW_VERSION"

for package_dir in "${RUNTIME_PACKAGES[@]}"; do
  bun pm pkg set "version=$NEW_VERSION" --cwd "$package_dir"
done

for package_dir in "${PI_PACKAGES[@]}"; do
  # Bump pi-extension's own version only. Its `dependencies.open-plan-annotator`
  # field is bumped later by update-release-metadata.mjs, AFTER `bun install`,
  # because root is not a workspace member — bun resolves that dep against
  # npm, and NEW_VERSION does not exist there until publish.
  bun pm pkg set "version=$NEW_VERSION" --cwd "$package_dir"
done

# --- Refresh lockfile ---
# Runs while pi-extension's open-plan-annotator dep still points at the
# currently-published version, so resolution succeeds.
echo "Refreshing bun.lock..."
bun install

# --- Update plugin/marketplace metadata + pi-extension dep ---
bun scripts/update-release-metadata.mjs "$NEW_VERSION"

# --- Build ---
echo "Building UI..."
bun run build:ui

echo "Cross-compiling binaries..."
bun scripts/build-platforms.mjs

# --- Git tag + commit ---
echo ""
git add package.json bun.lock .claude-plugin/plugin.json .claude-plugin/marketplace.json packages/runtime-*/package.json packages/pi-extension/package.json
git commit -m "v$NEW_VERSION"
git tag -m "v$NEW_VERSION" "v$NEW_VERSION"

# --- Push ---
echo ""
git push --follow-tags

# --- Publish ---
echo "Publishing runtime packages to npm..."
for package_dir in "${RUNTIME_PACKAGES[@]}"; do
  bun publish --cwd "$package_dir" --access public
done

echo "Publishing main package to npm..."
bun publish

echo "Publishing Pi extension package to npm..."
for package_dir in "${PI_PACKAGES[@]}"; do
  bun publish --cwd "$package_dir" --access public
done

echo ""
echo "Done! Released v$NEW_VERSION"
