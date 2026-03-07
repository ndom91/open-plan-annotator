# Release

## Quick path

```sh
bun run release
```

This builds the UI and cross-compiles binaries into the platform runtime packages under `packages/runtime-*`.

## Full release script

```sh
bun run do-release
```

`scripts/release.sh` will:

- Prompt for semver bump.
- Update versions in `package.json`, the runtime package manifests, `.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json`.
- Build the UI and all platform runtime binaries.
- Create git commit + tag, push, publish all runtime packages, and then publish the main npm package.

## Why the release script uses npm

This repo uses Bun for local development workflows (`install`, `build`, `test`), but `scripts/release.sh` intentionally uses npm for:

- `npm version` to apply npm-standard semver version updates tied to package metadata.
- `npm publish` because the package is published to the npm registry and we rely on npm's publish lifecycle/packaging behavior.

Using npm here avoids ambiguity in the final package + publish path while keeping Bun as the default developer runtime.
