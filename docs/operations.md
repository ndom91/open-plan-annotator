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

- `prepack` swaps in `CLAUDE.plugin.md` as `CLAUDE.md` for npm package output.
- `postpack` restores the local developer `CLAUDE.md` from backup.
- Script: `scripts/claude-pack-docs.mjs` (idempotent for repeated prepack/postpack calls).
