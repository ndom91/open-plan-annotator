# open-plan-annotator: Development Guide

## What This Is

A fully local Claude Code plugin that intercepts `ExitPlanMode` hook events and opens a browser UI for reviewing and annotating plans before code is written. Ships as a package-managed platform runtime binary (compiled via `bun build --compile`) that embeds the React UI. Also works as an OpenCode plugin via the `@opencode-ai/plugin` SDK.

## Architecture

```
Claude Code path:
  SessionStart hook fires
    → scripts/install-runtime.mjs   (Node: ensures per-platform runtime binary is present)
      → If missing: fetches @open-plan-annotator/runtime-<platform>-<arch>@<version>
        tarball from the npm registry, verifies dist.integrity, extracts the
        compiled Bun binary into packages/runtime-<platform>-<arch>/bin/.
      → If present: exits 0 immediately (fast path).

  ExitPlanMode hook fires
    → bin/open-plan-annotator.mjs   (Node wrapper: buffers stdin, resolves runtime package, delegates)
      → packages/runtime-<platform>-<arch>/bin/open-plan-annotator  (compiled Bun binary)
        → Reads hook JSON from stdin
        → Starts HTTP server on ephemeral port
        → Opens browser to the UI
        → Blocks until user approves/denies
        → Writes hook response JSON to stdout

OpenCode path:
  Agent calls annotate_plan tool
    → opencode/index.js             (OpenCode plugin entry, loaded via package.json "main")
      → opencode/bridge.js          (constructs fake HookEvent, spawns binary)
        → bin/open-plan-annotator.mjs → binary (same as above)
      → Parses HookOutput, returns approval/feedback to agent
```

The OpenCode plugin bridges to the same binary by constructing a Claude-format `HookEvent` payload and parsing the `HookOutput` response. This means there is only one server/UI codepath.

### Runtime distribution

The main npm package (`open-plan-annotator`) is small and ships no compiled binary. Per-platform binaries live in their own runtime packages (`@open-plan-annotator/runtime-darwin-arm64`, `-darwin-x64`, `-linux-arm64`, `-linux-x64`), each compiled with `bun build --compile --target=bun-<platform>`. These are listed as `optionalDependencies` so `npm install` picks the right one automatically.

For environments that don't run `npm install` after fetching the plugin (Claude Code plugin install is one such case), the `SessionStart` hook above installs the matching runtime package directly from the npm registry on first session per version. `shared/runtimeResolver.mjs` checks both `require.resolve(...)` and the workspace fallback path (`packages/runtime-<…>/bin/open-plan-annotator`) — the SessionStart installer writes to the latter, so the resolver finds it either way.

### Key Files

- `bin/open-plan-annotator.mjs` — npm bin wrapper. Buffers stdin, resolves the installed platform runtime package, delegates to the binary, and exposes `doctor`.
- `scripts/install-runtime.mjs` — Run from the `SessionStart` Claude Code hook. Ensures the per-platform runtime binary is present by fetching it from the npm registry on first session per version. No-op fast path when the binary is already installed.
- `shared/runtimeResolver.mjs` — Maps platform/arch to the correct runtime package and resolves its binary path.
- `server/index.ts` — Main entry. Parses hook event, manages plan history, starts Bun HTTP server, outputs hook response.
- `server/api.ts` — Routes: `GET /api/plan`, `POST /api/approve`, `POST /api/deny`, `POST /api/settings`, and catch-all serving the embedded HTML.
- `server/launch.ts` — Cross-platform `open` / `xdg-open` browser launcher.
- `server/types.ts` — Shared types (`HookEvent`, `HookOutput`, `Annotation`, `ServerState`, `ServerDecision`, `UserPreferences`).
- `opencode/index.js` — OpenCode plugin entry point. Registers `annotate_plan` tool, injects system prompt instructions, handles implementation agent handoff.
- `opencode/bridge.js` — Spawns the binary with a fake HookEvent, parses the HookOutput response.
- `opencode/config.js` — Reads `open-plan-annotator.json` config for implementation handoff settings.
- `ui/` — React + Vite frontend, built to a single `build/index.html` embedded at compile time.
- `hooks/hooks.json` — Claude Code hook registration. `SessionStart` runs `scripts/install-runtime.mjs` (runtime fetch) and `scripts/session-context.mjs` (injects plan-routing instructions into Claude's session context). `PreToolUse:ExitPlanMode` launches the annotator binary for Conductor-compatible denies; `PermissionRequest:ExitPlanMode` preserves native Claude Code approval behavior.
- `skills/plan-review-triggers/SKILL.md` — Auto-loaded Claude Code skill with the full trigger heuristics. This is the long-form reference; the SessionStart context injection is the always-on nudge that keeps Claude from rationalizing past it.

## Critical Rules

- **stdout is reserved for Claude Code.** The JSON hook response is the ONLY thing that may be written to stdout. All logs, progress, and diagnostics MUST go to stderr (`console.error`, `process.stderr.write`).
- **Trigger rules live in `skills/plan-review-triggers/SKILL.md`** (long-form reference) and `scripts/session-context.mjs` (terse always-on injection). Claude Code plugin installs do NOT auto-load repo-root markdown — only `hooks/`, `commands/`, `skills/`, and `agents/`. Don't ship instructions via root-level CLAUDE.md.
- **The binaries are not committed.** Runtime package binaries under `packages/runtime-*/bin/` are generated during build and ignored by git.
- **The OpenCode plugin uses plain JS (not TypeScript).** The `opencode/` directory ships as-is in the npm package — no build step. Keep it as `.js` files with JSDoc types.
- **Never use 'as any'** Always use the correct type.
- **We use bun** not pnpm, npm or yarn in this project.
- **Always double check your work** before telling me you're done by running the
  typecheck, lint, and test scripts.

## Development

```sh
bun run dev            # Server (port 3847) + Vite UI (port 5173)
bun run dev:server     # Server only (NODE_ENV=development, uses DEV_PLAN)
bun run dev:ui         # Vite dev server only
```

In dev mode, `server/index.ts` uses a hardcoded `DEV_PLAN` and skips stdin parsing. The UI proxies API calls to port 3847.

## Build & Release

```sh
bun run build          # Build UI + cross-compile binaries into packages/runtime-*/bin/
bun run release        # Alias for build
./scripts/release.sh   # Full release: bump versions, build, git tag, and publish runtime + main npm packages
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

Claude Code sends a `HookEvent` JSON on stdin with `tool_input.plan` containing the plan markdown. The binary responds on stdout with a `HookOutput` JSON matching the incoming hook event.

For `PreToolUse`:

- Approve: `{ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" } }`
- Deny: `{ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "..." } }`

For `PermissionRequest`:

- Approve: `{ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow" } } }`
- Deny: `{ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: "..." } } }`

The deny feedback field (`permissionDecisionReason` or `decision.message`) contains serialized annotations (deletions, replacements, insertions, comments) as markdown so Claude can revise the plan.

The hook is registered on both `PreToolUse` and `PermissionRequest`. `PreToolUse` fires before the permission flow and regardless of `--permission-mode`, which makes Request Changes (`deny`) work in Conductor. Native Claude Code still needs `PermissionRequest` to apply final plan approval. When both fire for the same tool call, the `PreToolUse` decision is cached briefly and replayed to `PermissionRequest` so the browser UI opens only once.

**Approving ExitPlanMode requires `allow` + `updatedInput`, not `allow` alone.** `ExitPlanMode` is an interaction-required tool: a `PreToolUse` hook returning `permissionDecision: "allow"` on its own is *ignored* for the plan-approval step, so Claude Code still shows the native "Ready to code?" TUI prompt and the user has to approve a second time. Per the hooks docs, interaction-required tools (`ExitPlanMode`, `AskUserQuestion`) only skip their prompt when the hook returns `permissionDecision: "allow"` **together with `updatedInput`** echoing the tool's input. So on approve the binary emits `{ permissionDecision: "allow", updatedInput: <the full tool_input> }`. `updatedInput` replaces the entire input object, so it must include every field Claude Code injected (`plan`, `planFilePath`, `allowedPrompts`) — we echo `hookEvent.tool_input` verbatim. This is what makes web-UI approval skip the terminal prompt and send Claude straight to work. Do not drop `updatedInput` or "simplify" back to bare `allow` — that reintroduces the double-approve. (Empirically, `permissionDecision: "ask"` forces the native dialog, and a `PermissionRequest` `{decision:{behavior:"allow"}}` does not suppress the ExitPlanMode dialog in this Claude Code build; `allow` + `updatedInput` on `PreToolUse` is the only path that works.)

The OpenCode bridge (`opencode/bridge.js`) constructs the same `HookEvent` format and parses the same `HookOutput` response, so the binary always goes through the same code path.

## Plan Review Trigger Rules

When working on this repo, the same plan-review trigger rules that ship to end users also apply to you. Dogfood the plugin: when proposing non-trivial changes here, route through the annotator instead of pasting plans inline.

@skills/plan-review-triggers/SKILL.md
