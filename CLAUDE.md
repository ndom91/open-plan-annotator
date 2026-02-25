# open-plan-annotator: Development Guide

## What This Is

A fully local Claude Code plugin that intercepts `ExitPlanMode` hook events and opens a browser UI for reviewing and annotating plans before code is written. Ships as a native binary (compiled via `bun build --compile`) that embeds the React UI.

## Architecture

```
Hook fires (ExitPlanMode)
  → bin/open-plan-annotator.cjs   (Node wrapper: buffers stdin, downloads binary if needed, delegates)
    → bin/open-plan-annotator-binary  (compiled Bun binary)
      → Reads hook JSON from stdin
      → Starts HTTP server on ephemeral port
      → Opens browser to the UI
      → Blocks until user approves/denies
      → Writes hook response JSON to stdout
```

### Key Files

- `bin/open-plan-annotator.cjs` — npm bin wrapper. Buffers stdin, auto-downloads binary on first run, delegates to binary via `execFileSync`.
- `install.cjs` — Downloads platform-specific binary from GitHub Releases. Runs as `postinstall` or on-demand from the wrapper.
- `server/index.ts` — Main entry. Parses hook event, manages plan history, starts Bun HTTP server, outputs hook response.
- `server/api.ts` — Routes: `GET /api/plan`, `POST /api/approve`, `POST /api/deny`, and catch-all serving the embedded HTML.
- `server/launch.ts` — Cross-platform `open` / `xdg-open` browser launcher.
- `server/types.ts` — Shared types (`HookEvent`, `HookOutput`, `Annotation`, `ServerState`, `ServerDecision`).
- `ui/` — React + Vite frontend, built to a single `build/index.html` embedded at compile time.
- `hooks/hooks.json` — Claude Code hook registration.
- `CLAUDE.plugin.md` — Instructions shipped to end users (copied to `CLAUDE.md` during `npm pack` via prepack/postpack).

## Critical Rules

- **stdout is reserved for Claude Code.** The JSON hook response is the ONLY thing that may be written to stdout. All logs, progress, and diagnostics MUST go to stderr (`console.error`, `process.stderr.write`).
- **`CLAUDE.plugin.md` is user-facing.** It tells Claude to use plan mode. Keep developer-only content in this file (`CLAUDE.md`), not in `CLAUDE.plugin.md`.
- **The binary is not committed.** `bin/open-plan-annotator-binary` is in `.gitignore` and downloaded at install time.

## Development

```sh
bun run dev            # Server (port 3847) + Vite UI (port 5173)
bun run dev:server     # Server only (NODE_ENV=development, uses DEV_PLAN)
bun run dev:ui         # Vite dev server only
```

In dev mode, `server/index.ts` uses a hardcoded `DEV_PLAN` and skips stdin parsing. The UI proxies API calls to port 3847.

## Build & Release

```sh
bun run build          # Build UI + cross-compile binaries to dist/
bun run release        # Build + create tarballs
./scripts/release.sh   # Full release: bump version, build, git tag, GitHub Release, npm publish
```

Cross-compilation targets: `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`.

## Linting

Uses Biome for linting and formatting.

```sh
bun run lint           # Check
bun run lint:fix       # Auto-fix
bun run format         # Format
```

## Hook Protocol

Claude Code sends a `HookEvent` JSON on stdin with `tool_input.plan` containing the plan markdown. The binary responds on stdout with a `HookOutput` JSON:

- Approve: `{ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow" } } }`
- Deny: `{ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: "..." } } }`

The deny message contains serialized annotations (deletions, replacements, insertions, comments) as markdown so Claude can revise the plan.
