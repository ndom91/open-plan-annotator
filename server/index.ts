// Embedded at compile time by `bun build --compile`
import embeddedHtml from "../build/index.html" with { type: "text" };
import { createRouter } from "./api.ts";
import { resolveHistoryKey } from "./historyKey.ts";
import { openBrowser } from "./launch.ts";
import type { HookEvent, HookOutput, ServerDecision, ServerState, UserPreferences } from "./types.ts";

const DEV_PLAN = `# Example Plan

## Context

This is a test plan for development purposes.

## Steps

### Step 1: Set up the database

Create a new PostgreSQL database with the following schema for user management.

\`\`\`sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);
\`\`\`

### Step 2: Implement the API

Build REST endpoints for CRUD operations on the users table.

- GET /api/users — list all users
- POST /api/users — create a new user
- DELETE /api/users/:id — delete a user

### Step 3: Add authentication

Use JWT tokens for stateless authentication. Store refresh tokens in Redis.

> Note: We should consider rate limiting on the auth endpoints.

## Verification

Run the test suite and verify all endpoints return correct status codes.
`;

const isDev = process.env.NODE_ENV === "development";
const DEFAULT_PREFERENCES: UserPreferences = {
  autoCloseOnSubmit: false,
};

// 1. Read stdin and parse hook event
let planContent: string;
let hookEvent: HookEvent;

if (isDev) {
  planContent = DEV_PLAN;
  hookEvent = {
    session_id: "dev-session",
    transcript_path: "",
    cwd: process.cwd(),
    permission_mode: "default",
    hook_event_name: "PermissionRequest",
    tool_name: "ExitPlanMode",
    tool_use_id: "dev-tool-use",
    tool_input: { plan: DEV_PLAN },
  };
} else {
  const stdinText = await Bun.stdin.text();

  try {
    hookEvent = JSON.parse(stdinText) as HookEvent;
  } catch {
    process.stderr.write("open-plan-annotator: failed to parse stdin hook event\n");
    process.exit(1);
  }

  planContent = (hookEvent.tool_input?.plan as string) ?? "";

  if (!planContent) {
    // Fallback: read latest plan file from ~/.claude/plans/
    const plansDir = `${process.env.HOME}/.claude/plans`;
    try {
      const files = await Array.fromAsync(new Bun.Glob("*.md").scan(plansDir));
      if (files.length > 0) {
        const sorted = await Promise.all(
          files.map(async (fileName) => {
            const path = `${plansDir}/${fileName}`;
            const stat = await Bun.file(path).stat();
            return { path, mtime: stat?.mtime ?? 0 };
          }),
        );
        sorted.sort((a, b) => (b.mtime as number) - (a.mtime as number));
        planContent = await Bun.file(sorted[0].path).text();
      }
    } catch {
      // No fallback available
    }
  }

  if (!planContent) {
    process.stderr.write("open-plan-annotator: no plan content found\n");
    process.exit(1);
  }
}

// Load preferences
const configBase = process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`;
const configDir = `${configBase}/open-plan-annotator`;
const historyRootDir = `${configDir}/history`;
const preferencesPath = `${configDir}/preferences.json`;

let preferences: UserPreferences = { ...DEFAULT_PREFERENCES };
try {
  const rawPreferences = await Bun.file(preferencesPath).text();
  const parsed = JSON.parse(rawPreferences) as Partial<UserPreferences>;
  if (typeof parsed.autoCloseOnSubmit === "boolean") {
    preferences = { autoCloseOnSubmit: parsed.autoCloseOnSubmit };
  }
} catch {
  // Keep defaults when no file exists or parsing fails
}

const persistPreferences = async (nextPreferences: UserPreferences): Promise<void> => {
  const serialized = `${JSON.stringify(nextPreferences, null, 2)}\n`;
  try {
    await Bun.write(preferencesPath, serialized);
    return;
  } catch {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(configDir, { recursive: true });
    await Bun.write(preferencesPath, serialized);
  }
};

// 2. Set up decision promise
let resolveDecision: ((d: ServerDecision) => void) | null = null;
const decisionPromise = new Promise<ServerDecision>((resolve) => {
  resolveDecision = resolve;
});

// 3. Load the HTML — embedded as string in compiled binary, HTMLBundle object in dev
let htmlContent: string;
if (typeof embeddedHtml === "string") {
  htmlContent = embeddedHtml;
} else {
  // Dev mode: Bun returns an HTMLBundle object, read from disk instead
  try {
    htmlContent = await Bun.file(new URL("../build/index.html", import.meta.url).pathname).text();
  } catch {
    htmlContent = `<!DOCTYPE html><html><body><h1>open-plan-annotator</h1><p>UI not built yet. Run <code>bun run build:ui</code> first.</p></body></html>`;
  }
}

// Detect version history: check for previous plans stored by session
const planHistory: string[] = [];
let planVersion = 1;
const historySessionKey = resolveHistoryKey(hookEvent);
const historyDir = `${historyRootDir}/${historySessionKey}`;

if (!isDev) {
  try {
    const files = await Array.fromAsync(new Bun.Glob("*.md").scan(historyDir));
    const sorted = await Promise.all(
      files.map(async (f) => {
        const path = `${historyDir}/${f}`;
        const stat = await Bun.file(path).stat();
        return { path, mtime: stat?.mtime ?? 0 };
      }),
    );
    sorted.sort((a, b) => (a.mtime as number) - (b.mtime as number));
    for (const f of sorted) {
      planHistory.push(await Bun.file(f.path).text());
    }
    planVersion = planHistory.length + 1;
  } catch {
    // No history yet
  }

  // Save current plan to history
  try {
    await Bun.write(`${historyDir}/v${planVersion}.md`, planContent);
  } catch {
    try {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(historyDir, { recursive: true });
      await Bun.write(`${historyDir}/v${planVersion}.md`, planContent);
    } catch {
      // Non-critical — history is a nice-to-have
    }
  }
} else {
  // Dev mode: simulate a previous version
  planHistory.push(
    "# Example Plan\n\n## Context\n\nThis is the previous version of the plan.\n\n## Steps\n\n### Step 1: Set up SQLite\n\nUse SQLite instead of PostgreSQL.\n\n### Step 2: Build the API\n\nCreate basic CRUD endpoints.\n\n## Verification\n\nManual testing only.",
  );
  planVersion = 2;
}

const state: ServerState = {
  planContent,
  planVersion,
  planHistory,
  preferences,
  htmlContent,
  resolveDecision,
  persistPreferences,
};

// 4. Start server
const router = createRouter(state);

const server = Bun.serve({
  port: isDev ? 3847 : 0,
  fetch: router,
});

const url = `http://localhost:${server.port}`;
process.stderr.write(`open-plan-annotator: UI available at ${url}\n`);

// 5. Open browser (skip in dev — Vite serves the UI)
if (!isDev) openBrowser(url);

// 6. Block until user decides
const decision = await decisionPromise;

// 7. Clean up history directory
if (!isDev && decision.approved) {
  try {
    const { rmSync } = await import("node:fs");
    rmSync(historyDir, { recursive: true, force: true });
  } catch {
    // Non-critical cleanup
  }
}

// 8. Write hook decision to stdout and close the fd so the pipe flushes immediately.
//    This lets the parent process (wrapper/Claude/OpenCode) read the output and proceed
//    while the binary keeps running to serve the settings endpoint.
const output: HookOutput = {
  hookSpecificOutput: {
    hookEventName: "PermissionRequest",
    decision: decision.approved
      ? { behavior: "allow" }
      : { behavior: "deny", message: decision.feedback ?? "Plan changes requested." },
  },
};

const jsonLine = `${JSON.stringify(output)}\n`;
const { closeSync, writeSync } = await import("node:fs");

// Write directly to fd 1 (stdout) and close it to flush the pipe buffer.
// After this, all logging must use stderr (which we already do everywhere).
writeSync(1, jsonLine);
closeSync(1);

// 9. Keep server alive briefly so the browser can persist settings (e.g. auto-close toggle)
const keepAliveMs = isDev ? 10000 : Number(process.env.SHUTDOWN_DELAY_MS) || 10000;
await Bun.sleep(keepAliveMs);
server.stop();
