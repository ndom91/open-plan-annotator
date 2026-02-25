import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

interface OpenCodeResponse {
  ok: boolean;
  decision: "approve" | "deny";
  feedback?: string;
  message?: string;
}

async function waitForServerUrl(getStderr: () => string): Promise<string> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8000) {
    const match = getStderr().match(/UI available at (http:\/\/localhost:\d+)/);
    if (match) return match[1];
    await Bun.sleep(25);
  }
  throw new Error(`Timed out waiting for server URL. stderr:\n${getStderr()}`);
}

async function runInteractiveSession(args: {
  payload: Record<string, unknown>;
  denyWithFeedback?: boolean;
}): Promise<OpenCodeResponse> {
  const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-opencode-"));
  const fakeBin = join(tempRoot, "bin");

  mkdirSync(fakeBin, { recursive: true });
  const openShim = join(fakeBin, "open");
  writeFileSync(openShim, "#!/bin/sh\nexit 0\n", "utf8");
  chmodSync(openShim, 0o755);

  const xdgOpenShim = join(fakeBin, "xdg-open");
  writeFileSync(xdgOpenShim, "#!/bin/sh\nexit 0\n", "utf8");
  chmodSync(xdgOpenShim, 0o755);

  const cmdShim = join(fakeBin, "cmd");
  writeFileSync(cmdShim, "#!/bin/sh\nexit 0\n", "utf8");
  chmodSync(cmdShim, 0o755);

  const cmdExeShim = join(fakeBin, "cmd.cmd");
  writeFileSync(cmdExeShim, "@echo off\r\nexit /b 0\r\n", "utf8");

  const child = spawn(process.execPath, ["run", "server/index.ts"], {
    cwd: join(import.meta.dir, ".."),
    env: {
      ...process.env,
      OPEN_PLAN_ANNOTATOR_HOST: "opencode",
      NODE_ENV: "test",
      PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ""}`,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const childExit = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? -1));
  });

  try {
    child.stdin.write(`${JSON.stringify(args.payload)}\n`);
    child.stdin.end();

    const baseUrl = await waitForServerUrl(() => stderr);
    if (args.denyWithFeedback) {
      await fetch(`${baseUrl}/api/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotations: [
            {
              id: "a1",
              type: "comment",
              text: "Step 2",
              comment: "Needs measurable success criteria.",
              blockIndex: 0,
              startOffset: 0,
              endOffset: 6,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    } else {
      await fetch(`${baseUrl}/api/approve`, { method: "POST" });
    }

    const exitCode = await childExit;
    if (exitCode !== 0) {
      throw new Error(`Session exited with code ${exitCode}. stderr:\n${stderr}`);
    }

    return JSON.parse(stdout.trim()) as OpenCodeResponse;
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([childExit.catch(() => -1), Bun.sleep(1000)]);
      if (child.exitCode === null) {
        child.kill("SIGKILL");
        await childExit.catch(() => -1);
      }
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

describe("OpenCode flow", () => {
  test("approve path returns approve response", async () => {
    const response = await runInteractiveSession({
      payload: {
        host: "opencode",
        command: "submit_plan",
        sessionId: "sess-1",
        conversationId: "conv-1",
        plan: "# Plan\n\n- Step 1",
      },
    });

    expect(response.ok).toBe(true);
    expect(response.decision).toBe("approve");
  }, 20000);

  test("deny path returns deny response with feedback", async () => {
    const response = await runInteractiveSession({
      payload: {
        host: "opencode",
        command: "submit_plan",
        sessionId: "sess-2",
        conversationId: "conv-2",
        plan: "# Plan\n\n- Step 1\n- Step 2",
      },
      denyWithFeedback: true,
    });

    expect(response.ok).toBe(false);
    expect(response.decision).toBe("deny");
    expect(response.feedback).toContain("Needs measurable success criteria.");
  }, 20000);

  test("missing plan returns deterministic deny output", async () => {
    const child = spawn(process.execPath, ["run", "server/index.ts"], {
      cwd: join(import.meta.dir, ".."),
      env: {
        ...process.env,
        OPEN_PLAN_ANNOTATOR_HOST: "opencode",
        NODE_ENV: "test",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    const exitCode = new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolve(code ?? -1));
    });

    child.stdin.write(`${JSON.stringify({ host: "opencode", command: "submit_plan", sessionId: "sess-3" })}\n`);
    child.stdin.end();

    const code = await exitCode;
    expect(code).toBe(0);
    expect(stderr).toBe("");

    const response = JSON.parse(stdout.trim()) as OpenCodeResponse;
    expect(response.ok).toBe(false);
    expect(response.decision).toBe("deny");
    expect(response.feedback).toContain("No plan content was provided");
  }, 15000);
});
