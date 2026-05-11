# Operations

## Local development

```sh
bun install
bun run dev
```

Useful split modes:

- `bun run dev:server` (Bun server only)
- `bun run dev:ui` (Vite UI only)

## Required verification before shipping

```sh
bun run typecheck
bun run lint
bun test
```

## Packaging note

No npm-pack rename machinery. Repo-root `CLAUDE.md` (a symlink to `AGENTS.md`) is developer-only and excluded from the npm tarball. End-user plan-routing instructions live in `skills/plan-review-triggers/SKILL.md` (loaded by Claude Code as a skill) and `scripts/session-context.mjs` (injected into the session via the `SessionStart` hook).
