# Release

## Quick path

```sh
bun run release
```

This builds the UI and cross-compiles binaries into the platform runtime packages under `packages/runtime-*`.

Before publishing, also run:

```sh
bun run pack:check
bun run verify:opencode-plugin
```

`verify:opencode-plugin` imports a freshly packed tarball and checks that its
default OpenCode export has the stable V2 `id` and `setup()` shape. The package
also retains `server()` temporarily for OpenCode V1.18.29+ compatibility.

## Full release script

```sh
bun run do-release
```

`scripts/release.sh` will:

- Prompt for semver bump.
- Update versions in `package.json`, `packages/pi-extension/package.json`, the runtime package manifests, `.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json`.
- Build the UI and all platform runtime binaries.
- Create git commit + tag, push, publish all runtime packages with Bun, then publish the main npm package, and finally publish the Pi extension package with Bun.

## Release tooling

This repo now uses Bun for the release workflow too:

- `bun pm pkg` updates the root manifest and each runtime package manifest.
- `bun publish` publishes each runtime package and the main package to the npm registry.
- `bun` runs the release helper scripts directly, so the release path stays aligned with the rest of the repo.

We still keep the final git commit and tag as explicit `git` commands in `scripts/release.sh`. `bun pm version` auto-commits and tags immediately, which does not fit this repo's multi-file release flow where several manifests and plugin metadata files need to be updated together before the release commit is created.
