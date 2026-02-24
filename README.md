# open-plan-annotator

[![npm version](https://img.shields.io/npm/v/open-plan-annotator?style=flat-square)](https://www.npmjs.com/package/open-plan-annotator)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-pink?style=flat-square)]()

A fully local agentic coding plugin (claude-code, opencode) that intercepts plan mode, opens an annotation UI in your browser, and feeds structured feedback back to the agent.

Select text to <code style="color: purple">strikethrough</code>, <code style="color: orange">replace</code>, <code style="color: blue">insert</code>, or <code style="color: red">comment</code> — then approve the plan or request changes.


![](.github/assets/screenshot_01.png)


## How it works

1. Claude calls `ExitPlanMode`
2. A `PermissionRequest` hook launches the `open-plan-annotator` binary
3. An ephemeral HTTP server starts and opens a React UI in your browser
4. You review and annotate the plan
5. **Approve** — Claude proceeds with the plan
6. **Request Changes** — annotations are serialized as structured feedback and Claude revises

The server shuts down after you decide. Everything runs locally, nothing leaves your machine.

## Install

**1. Install the binary**

```sh
npm install -g open-plan-annotator
```

This JS shim downloads the correct binary for your platform (macOS, Linux).

> [!NOTE]
> If using pnpm, postinstall scripts will be blocked by default. You can run the
> 'open-plan-annotator' manually to trigger a download, or the first invocation
> by Claude will also trigger the binary download.

**2. Add the marketplace and install the plugin**

From within Claude Code:

```
/plugin marketplace add ndom91/open-plan-annotator
/plugin install open-plan-annotator@ndom91-open-plan-annotator
```

This registers the `ExitPlanMode` hook that launches the annotation UI.


> [!NOTE]
> The first run might take a few seconds if you hadn't installed the binary, as
> Claude will trigger the download then.

### From source

```sh
git clone https://github.com/ndom91/open-plan-annotator.git
cd open-plan-annotator
bun install
bun run build
```

Then load it directly in Claude Code:

```sh
claude --plugin-dir ./open-plan-annotator
```

## Annotations

| Type | Shortcut | Description |
|------|----------|-------------|
| Delete | `d` | Strikethrough selected text |
| Replace | `r` | Replace selected text with new text |
| Insert | `i` | Insert text after selection |
| Comment | `c` | Attach a comment to selected text |

Global shortcuts: `Cmd+Enter` to approve, `Cmd+Shift+Enter` to request changes.

## Development

```sh
bun run dev
```

Starts the Bun server on port 3847 with a test plan and the Vite dev server on port 5173 with HMR.

```sh
bun run lint        # check
bun run lint:fix    # auto-fix
bun run format      # format
```

## License

MIT
