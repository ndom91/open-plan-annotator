// Embedded at compile time by `bun build --compile`
import embeddedHtml from "../build/index.html" with { type: "text" };
import { claudeAdapter } from "./adapters/claude.ts";
import { opencodeAdapter } from "./adapters/opencode.ts";
import { createRouter } from "./api.ts";
import { resolveHistoryKey } from "./historyKey.ts";
import { openBrowser } from "./launch.ts";
import type { HostAdapter, PlanReviewDecision, PlanReviewRequest, ServerState } from "./types.ts";

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
const adapters: Record<"claude" | "opencode", HostAdapter> = {
  claude: claudeAdapter,
  opencode: opencodeAdapter,
};

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveAdapter(stdinText: string): HostAdapter {
  const fromEnv = toStringOrNull(process.env.OPEN_PLAN_ANNOTATOR_HOST)?.toLowerCase();
  if (fromEnv === "claude" || fromEnv === "opencode") {
    return adapters[fromEnv];
  }

  if (!stdinText.trim()) {
    return adapters.claude;
  }

  try {
    const parsed = JSON.parse(stdinText) as Record<string, unknown>;

    const command = toStringOrNull(parsed.command) ?? toStringOrNull(parsed.tool);
    if (command === "submit_plan") {
      return adapters.opencode;
    }

    if (toStringOrNull(parsed.host)?.toLowerCase() === "opencode") {
      return adapters.opencode;
    }

    if (typeof parsed.tool_input === "object" || toStringOrNull(parsed.hook_event_name) === "PermissionRequest") {
      return adapters.claude;
    }
  } catch {
    return adapters.claude;
  }

  return adapters.claude;
}

const stdinText = isDev ? "" : await Bun.stdin.text();
const adapter = resolveAdapter(stdinText);
const parsed = await adapter.parseRequest({ stdinText, isDev, devPlan: DEV_PLAN });

if (!parsed.ok) {
  if (parsed.stderr) process.stderr.write(parsed.stderr);
  if (parsed.stdout) process.stdout.write(parsed.stdout);
  process.exit(parsed.exitCode);
}

const request: PlanReviewRequest = parsed.request;
const planContent = request.planContent;

// 2. Set up decision promise
let resolveDecision: ((d: PlanReviewDecision) => void) | null = null;
const decisionPromise = new Promise<PlanReviewDecision>((resolve) => {
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
const configBase = process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`;
const historyRootDir = `${configBase}/open-plan-annotator/history`;
const historySessionKey = resolveHistoryKey(request.historyKeySource);
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
  htmlContent,
  resolveDecision,
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

// 8. Give browser time to show confirmation
await Bun.sleep(1200);
server.stop();

// 9. Write hook decision to stdout
console.log(adapter.formatDecision(decision));
