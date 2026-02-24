## Project Context

A TypeScript project designed to be used as an agentic coding plugin (i.e. for
opencode, claude-code, etc.). The project is structured with both
server-side and client-side code. After being installed as a plugin, the
project registers a hook that triggers it to be launched after the coding
assistant has generated a plan. This plan is then rendered in a browser UI
allowing the user to annotate it with any comments, additions, insertions or
deletions and the resulting plan is then sent back to the agent.

## Commands

```bash
bun run build:ui
bun run build:server
bun run build
bun run dev
bun run lint
bun run format
```

## Architecture

**Key directories:**
- `plugin/`
- `server/` - Server-side code
- `ui/`

## Boundaries

**Always:**
- Run existing tests before committing changes
- Run `bun run lint` before committing
- Follow mixed naming convention
- Follow flat file organization
- We use bun, not pnpm, npm or yarn

**Ask first:**
- Adding new dependencies
- Changing project configuration files

**Never:**
- Commit secrets, API keys, or .env files
- Delete or overwrite test files without understanding them
- Force push to main/master branch
