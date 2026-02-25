# open-plan-annotator

[![npm version](https://img.shields.io/npm/v/open-plan-annotator?style=flat-square)](https://www.npmjs.com/package/open-plan-annotator)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-pink?style=flat-square)]()

A fully local plan-review plugin for Claude Code and OpenCode. It opens an annotation UI in your browser and returns structured approve/deny decisions back to the host.

Select text to <code style="color: purple">strikethrough</code>, <code style="color: orange">replace</code>, <code style="color: blue">insert</code>, or <code style="color: red">comment</code> — then approve the plan or request changes.


![](.github/assets/screenshot_1.png)


## How it works

1. Host submits a plan to `open-plan-annotator`
2. An ephemeral HTTP server starts and opens a React UI in your browser
3. You review and annotate the plan
4. **Approve** or **Request Changes**
5. The tool returns host-specific JSON output (Claude hook output or OpenCode plugin output)

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

### Claude Code

Add the marketplace and install the plugin:

From within Claude Code:

```
/plugin marketplace add ndom91/open-plan-annotator
/plugin install open-plan-annotator@ndom91-open-plan-annotator
```

This registers the `ExitPlanMode` hook that launches the annotation UI.


> [!NOTE]
> The first run might take a few seconds if you hadn't installed the binary, as
> Claude will trigger the download then.

### OpenCode

If you installed `open-plan-annotator` globally, install the OpenCode plugin assets from your target project directory:

```sh
npm install -g open-plan-annotator
cd /path/to/your/project
open-plan-annotator-install-opencode
```

This installs `opencode-plugin/` to:

```text
./.opencode/plugins/open-plan-annotator
```

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

For OpenCode local development:

```sh
bun run install:opencode-plugin
```

Then configure OpenCode to call the local plugin command `submit_plan` from `./.opencode/plugins/open-plan-annotator`.

## OpenCode submit_plan contract

This repo ships a pragmatic, self-contained OpenCode plugin contract (until a strict upstream schema is finalized).

Input JSON (plugin -> binary):

```json
{
  "host": "opencode",
  "command": "submit_plan",
  "plan": "# Plan...",
  "sessionId": "optional-session-id",
  "conversationId": "optional-conversation-id",
  "cwd": "/optional/cwd",
  "metadata": {}
}
```

Output JSON (binary -> plugin/OpenCode):

```json
{
  "ok": true,
  "decision": "approve"
}
```

or

```json
{
  "ok": false,
  "decision": "deny",
  "feedback": "Plan changes requested..."
}
```

If `plan` is missing/empty, output is deterministic deny with a clear feedback message.

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
