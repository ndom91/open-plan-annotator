# Architecture

## Runtime paths

- Claude Code hook path: `bin/open-plan-annotator.mjs` -> runtime resolver -> platform runtime package binary -> `server/index.ts` runtime.
- OpenCode path: `opencode/index.js` -> `opencode/bridge.js` -> same runtime resolver + runtime package binary.
- Shared behavior: both paths produce the same Claude hook payload/response format.

## Server runtime modules

- `server/runtime/input.ts`: stdin parsing, dev-mode plan bootstrap, fallback `~/.claude/plans` loading.
- `server/runtime/preferences.ts`: config paths plus preference load/persist logic.
- `server/runtime/history.ts`: per-session history load/write and cleanup.
- `server/runtime/html.ts`: embedded UI string loading with dev fallback.
- `server/runtime/decision.ts`: decision promise control and stdout-safe hook output.
- `server/index.ts`: orchestration only (startup, router wiring, update check, lifecycle).

## Packaging and updates

- `open-plan-annotator` is the canonical npm package.
- Platform-specific runtime packages live under `packages/runtime-*` and each ship one compiled binary.
- `shared/runtimeResolver.mjs` resolves the correct runtime package for the current platform.
- Updates are package-managed by the host (`OpenCode`, `Claude Code`, or the user's package manager); the runtime never self-updates in place.
