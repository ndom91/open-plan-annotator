import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "..");

/** Lay out a minimal plugin tree whose runtime binary is the given shell script. */
function createPluginTree(runtimeScript: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opa-wrapper-"));
  fs.cpSync(path.join(repoRoot, "bin", "open-plan-annotator.mjs"), path.join(root, "bin", "open-plan-annotator.mjs"));
  fs.cpSync(path.join(repoRoot, "shared"), path.join(root, "shared"), {
    recursive: true,
    filter: (src) => !src.endsWith(".test.ts"),
  });
  fs.writeFileSync(path.join(root, "package.json"), '{"name":"open-plan-annotator","version":"0.0.0-test"}');

  const binaryPath = path.join(
    root,
    "packages",
    `runtime-${process.platform}-${process.arch}`,
    "bin",
    "open-plan-annotator",
  );
  fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
  fs.writeFileSync(binaryPath, runtimeScript, { mode: 0o755 });
  return root;
}

interface WrapperResult {
  code: number | null;
  stdout: string;
  stderr: string;
  /** ms from spawn until both stdout and stderr reached end-of-stream */
  stdioClosedAfterMs: number;
}

function runHook(root: string, env: NodeJS.ProcessEnv = {}): Promise<WrapperResult> {
  const start = Date.now();
  const child = spawn("node", [path.join(root, "bin", "open-plan-annotator.mjs")], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, OPEN_PLAN_ANNOTATOR_SKIP_INSTALL: "1", ...env },
  });
  child.stdin.end(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input: {} }));

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const stdoutEnd = new Promise((resolve) => child.stdout.on("end", resolve));
  const stderrEnd = new Promise((resolve) => child.stderr.on("end", resolve));
  const exit = new Promise<number | null>((resolve) => child.on("exit", resolve));

  return Promise.all([exit, stdoutEnd, stderrEnd]).then(([code]) => ({
    code,
    stdout,
    stderr,
    stdioClosedAfterMs: Date.now() - start,
  }));
}

describe.if(process.platform !== "win32")("open-plan-annotator wrapper (hook mode)", () => {
  test("exits 2 with a diagnosis when the runtime fails without a hook response", async () => {
    const root = createPluginTree("#!/bin/sh\nexit 3\n");

    const result = await runHook(root);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("exited with code 3 without a hook response");
    expect(result.stderr).toContain("open-plan-annotator doctor");
  });

  test("closes stdio as soon as the hook response is forwarded", async () => {
    // The runtime lingers (like the real keepalive) while holding stderr open.
    const root = createPluginTree("#!/bin/sh\necho '{\"ok\":true}'\nsleep 3\necho late >&2\n");

    const result = await runHook(root);

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('{"ok":true}\n');
    expect(result.stdioClosedAfterMs).toBeLessThan(2000);
  });

  test("exits 0 without running the runtime when the skip file exists", async () => {
    const root = createPluginTree("#!/bin/sh\necho '{\"ok\":true}'\n");
    const skipFile = path.join(root, "skip");
    fs.writeFileSync(skipFile, "");

    const result = await runHook(root, { OPEN_PLAN_ANNOTATOR_SKIP_FILE: skipFile });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
  });
});
