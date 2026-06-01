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

wait_for_npm_version() {
  local spec="$1"
  local max_attempts="${2:-36}"
  local attempt=0
  local delay=5

  echo "Waiting for $spec on npm registry..."
  until npm view "$spec" version --registry https://registry.npmjs.org >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "Timed out waiting for $spec after $max_attempts attempts."
      return 1
    fi

    echo "npm registry did not resolve $spec; retrying in ${delay}s ($attempt/$max_attempts)..."
    sleep "$delay"
    if [ "$delay" -lt 30 ]; then
      delay=$((delay * 2))
      if [ "$delay" -gt 30 ]; then
        delay=30
      fi
    fi
  done
}

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

# --- Git commit + tag (local only; push deferred until after publish) ---
echo ""
git add package.json bun.lock .claude-plugin/plugin.json .claude-plugin/marketplace.json packages/runtime-*/package.json packages/pi-extension/package.json
git commit -m "v$NEW_VERSION"
git tag -m "v$NEW_VERSION" "v$NEW_VERSION"

# --- Publish ---
# Publish before pushing so CI (triggered by tag/push) can resolve NEW_VERSION
# on npm immediately.
echo "Publishing runtime packages to npm..."
for package_dir in "${RUNTIME_PACKAGES[@]}"; do
  bun publish --cwd "$package_dir" --access public
done

echo ""
for package_dir in "${RUNTIME_PACKAGES[@]}"; do
  package_name=$(bun pm pkg get name --cwd "$package_dir" | tr -d '"')
  if ! wait_for_npm_version "$package_name@$NEW_VERSION" 36; then
    echo "$package_name@$NEW_VERSION is not visible on npm yet; aborting before main package publish."
    echo "Recovery: rerun npm validation, publish remaining packages if needed, then git push --follow-tags."
    exit 1
  fi
done

echo "Publishing main package to npm..."
bun publish

echo ""
if ! wait_for_npm_version "open-plan-annotator@$NEW_VERSION" 36; then
  echo "open-plan-annotator@$NEW_VERSION is not visible on npm yet; aborting before dependent package publish."
  echo "Recovery: rerun npm validation, publish packages/pi-extension if needed, then git push --follow-tags."
  exit 1
fi

echo "Publishing Pi extension package to npm..."
for package_dir in "${PI_PACKAGES[@]}"; do
  bun publish --cwd "$package_dir" --access public
done

# --- Wait for npm propagation ---
# `bun publish` returns before the version is queryable on the registry.
# Poll using `npm view` (uses live registry, no cache) until NEW_VERSION
# resolves.
echo ""
for package_dir in "${PI_PACKAGES[@]}"; do
  package_name=$(bun pm pkg get name --cwd "$package_dir" | tr -d '"')
  if ! wait_for_npm_version "$package_name@$NEW_VERSION" 36; then
    echo "$package_name@$NEW_VERSION is not visible on npm yet; aborting before git push."
    echo "Recovery: rerun npm validation, then git push --follow-tags."
    exit 1
  fi
done

# --- Push ---
echo ""
git push --follow-tags

# --- Post-publish lockfile sync ---
# Bun caches registry metadata separately from npm; clear it so the freshly
# published NEW_VERSION resolves. Retry on transient cache-miss errors.
echo ""
echo "Syncing bun.lock against published versions..."
bun pm cache rm >/dev/null 2>&1 || true

ATTEMPTS=0
MAX_ATTEMPTS=12
DELAY=5
until bun install --force; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "bun install failed to resolve $NEW_VERSION after $MAX_ATTEMPTS attempts; aborting lockfile sync."
    exit 1
  fi
  echo "bun install failed; clearing cache and retrying in ${DELAY}s ($ATTEMPTS/$MAX_ATTEMPTS)..."
  bun pm cache rm >/dev/null 2>&1 || true
  sleep "$DELAY"
  if [ "$DELAY" -lt 30 ]; then
    DELAY=$((DELAY * 2))
    if [ "$DELAY" -gt 30 ]; then
      DELAY=30
    fi
  fi
done

if ! git diff --quiet bun.lock; then
  git add bun.lock
  git commit -m "Bump bun.lock for v$NEW_VERSION"
  git push
fi

echo ""
echo "Done! Released v$NEW_VERSION"
