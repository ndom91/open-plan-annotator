import { applyAnnotations, createRouter } from "./api.ts";
import { openBrowser } from "./launch.ts";
import type { HookEvent, HookOutput, ServerDecision, ServerState } from "./types.ts";

// Embedded at compile time by `bun build --compile`
// @ts-ignore — returns string in compiled binary, HTMLBundle when run directly
import embeddedHtml from "../build/index.html" with { type: "text" };

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

// 1. Read stdin
let planContent: string;
let planFilePath: string | null = null;

if (isDev) {
  planContent = DEV_PLAN;
} else {
  const stdinText = await Bun.stdin.text();
  try {
    const event = JSON.parse(stdinText) as HookEvent;
    planContent = (event.tool_input?.plan as string) ?? "";

    // Fallback: read the most recent plan file from ~/.claude/plans/
    if (!planContent) {
      const plansDir = `${process.env.HOME}/.claude/plans`;
      try {
        const files = await Array.fromAsync(new Bun.Glob("*.md").scan(plansDir));
        if (files.length > 0) {
          // Sort by modification time, newest first
          const sorted = await Promise.all(
            files.map(async (f) => {
              const path = `${plansDir}/${f}`;
              const stat = await Bun.file(path).stat();
              return { path, mtime: stat?.mtime ?? 0 };
            }),
          );
          sorted.sort((a, b) => (b.mtime as number) - (a.mtime as number));
          planFilePath = sorted[0].path;
          planContent = await Bun.file(planFilePath).text();
        }
      } catch {
        // Plans directory doesn't exist or is empty
      }
    }

    // If plan came from tool_input, find matching plan file on disk
    if (planContent && !planFilePath) {
      const plansDir = `${process.env.HOME}/.claude/plans`;
      try {
        const files = await Array.fromAsync(new Bun.Glob("*.md").scan(plansDir));
        const sorted = await Promise.all(
          files.map(async (f) => {
            const path = `${plansDir}/${f}`;
            const stat = await Bun.file(path).stat();
            return { path, mtime: stat?.mtime ?? 0 };
          }),
        );
        sorted.sort((a, b) => (b.mtime as number) - (a.mtime as number));
        // Find the file whose content matches the plan
        for (const f of sorted) {
          const content = await Bun.file(f.path).text();
          if (content.trim() === planContent.trim()) {
            planFilePath = f.path;
            break;
          }
        }
        // If no exact match, use the most recent file
        if (!planFilePath && sorted.length > 0) {
          planFilePath = sorted[0].path;
        }
      } catch {
        // Plans directory doesn't exist
      }
    }
  } catch {
    process.stderr.write("open-plan-annotator: failed to parse stdin hook event\n");
    process.exit(1);
  }
}

if (!planContent) {
  process.stderr.write("open-plan-annotator: no plan content found\n");
  process.exit(1);
}

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

if (!isDev) {
  const historyDir = `${process.env.HOME}/.open-plan-annotator/history`;
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
    const dir = `${process.env.HOME}/.open-plan-annotator/history`;
    await Bun.write(`${dir}/v${planVersion}.md`, planContent);
  } catch {
    try {
      const dir = `${process.env.HOME}/.open-plan-annotator/history`;
      const { mkdirSync } = await import("node:fs");
      mkdirSync(dir, { recursive: true });
      await Bun.write(`${dir}/v${planVersion}.md`, planContent);
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
  planFilePath,
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

// 7. Apply annotations to the plan file on disk
if (!decision.approved && decision.annotations?.length && planFilePath) {
  try {
    const modifiedPlan = applyAnnotations(planContent, decision.annotations);
    await Bun.write(planFilePath, modifiedPlan);
    process.stderr.write(`open-plan-annotator: wrote modified plan to ${planFilePath}\n`);
  } catch (err) {
    process.stderr.write(`open-plan-annotator: failed to write modified plan: ${err}\n`);
  }
}

// 8. Give browser time to show confirmation
await Bun.sleep(1200);
server.stop();

// 9. Write hook decision to stdout
const output: HookOutput = {
  hookSpecificOutput: {
    hookEventName: "PermissionRequest",
    decision: decision.approved
      ? { behavior: "allow" }
      : { behavior: "deny", message: decision.feedback ?? "Plan changes requested." },
  },
};

console.log(JSON.stringify(output));
