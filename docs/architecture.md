# Architecture

## Runtime paths

- Claude Code hook path: `bin/open-plan-annotator.mjs` -> compiled binary -> `server/index.ts` runtime.
- OpenCode path: `opencode/index.js` -> `opencode/bridge.js` -> same wrapper + binary path.
- Shared behavior: both paths produce the same Claude hook payload/response format.

## Server runtime modules

- `server/runtime/input.ts`: stdin parsing, dev-mode plan bootstrap, fallback `~/.claude/plans` loading.
- `server/runtime/preferences.ts`: config paths plus preference load/persist logic.
- `server/runtime/history.ts`: per-session history load/write and cleanup.
- `server/runtime/html.ts`: embedded UI string loading with dev fallback.
- `server/runtime/decision.ts`: decision promise control and stdout-safe hook output.
- `server/index.ts`: orchestration only (startup, router wiring, update check, lifecycle).

## Update/checksum flow

- Shared asset/checksum helpers live in `shared/releaseAssets.mjs`.
- `install.mjs` uses these helpers during postinstall binary download verification.
- `server/updateCheck.ts` uses the same checksum parsing/asset selection during update checks.
