#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function toStringOrNull(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildInput(raw) {
  const payload = raw && typeof raw === "object" ? raw : {};
  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

  return {
    host: "opencode",
    command: "submit_plan",
    plan: toStringOrNull(payload.plan),
    sessionId: toStringOrNull(payload.sessionId) ?? toStringOrNull(metadata.sessionId),
    conversationId: toStringOrNull(payload.conversationId) ?? toStringOrNull(metadata.conversationId),
    cwd: toStringOrNull(payload.cwd) ?? toStringOrNull(metadata.cwd) ?? process.cwd(),
    metadata,
  };
}

function resolveRunner() {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(moduleDir, "..");
  const sourceServer = join(repoRoot, "server", "index.ts");
  const packageBin = join(repoRoot, "bin", "open-plan-annotator.cjs");
  const projectLocal = join(process.cwd(), "node_modules", ".bin", "open-plan-annotator");

  if (existsSync(sourceServer) && process.env.OPEN_PLAN_ANNOTATOR_FORCE_BINARY !== "1") {
    return { command: "bun", args: ["run", sourceServer] };
  }

  if (existsSync(packageBin)) {
    return { command: process.execPath, args: [packageBin] };
  }

  if (existsSync(projectLocal)) {
    return { command: projectLocal, args: [] };
  }

  return { command: "open-plan-annotator", args: [] };
}

function normalizeOutput(stdout, stderr, status) {
  const text = String(stdout ?? "").trim();
  if (!text) {
    return {
      ok: false,
      decision: "deny",
      feedback: stderr || "open-plan-annotator returned empty output",
      message: "Plan changes requested.",
      status: status ?? 1,
    };
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // fall through
  }

  return {
    ok: false,
    decision: "deny",
    feedback: `Unexpected response from open-plan-annotator: ${text}`,
    message: "Plan changes requested.",
    status: status ?? 1,
  };
}

export async function submit_plan(input) {
  const payload = buildInput(input);
  const runner = resolveRunner();
  const result = spawnSync(runner.command, runner.args, {
    input: JSON.stringify(payload),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  return normalizeOutput(result.stdout, result.stderr, result.status);
}

async function main() {
  const command = process.argv[2] ?? "submit_plan";
  if (command !== "submit_plan") {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        decision: "deny",
        feedback: `Unsupported command: ${command}`,
        message: "Plan changes requested.",
      }),
    );
    process.exit(0);
  }

  let input = {};
  try {
    const stdin = readFileSync(0, "utf8");
    input = stdin.trim().length > 0 ? JSON.parse(stdin) : {};
  } catch {
    input = {};
  }

  const result = await submit_plan(input);
  process.stdout.write(JSON.stringify(result));
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && modulePath === process.argv[1]) {
  main();
}
