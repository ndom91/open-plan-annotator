import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { resolveHistoryKey } from "./historyKey.ts";

type SessionDecision = "approve" | "deny";

interface SessionResult {
  version: number;
  history: string[];
  outputBehavior: "allow" | "deny";
}

function seedUpdateCheckCache(configHome: string) {
  const annotatorConfigDir = join(configHome, "open-plan-annotator");
  mkdirSync(annotatorConfigDir, { recursive: true });
  writeFileSync(
    join(annotatorConfigDir, "update-check.json"),
    JSON.stringify({ latestVersion: "0.0.0", checkedAt: Date.now(), assetUrl: null, assetSha256: null }),
    "utf8",
  );
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

async function runSession(args: {
  decision: SessionDecision;
  plan: string;
  env: Record<string, string>;
  hookEvent: Record<string, unknown>;
}): Promise<SessionResult> {
  const child = spawn(process.execPath, ["run", "server/index.ts"], {
    cwd: join(import.meta.dir, ".."),
    env: { ...process.env, ...args.env },
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
    const payload = {
      ...args.hookEvent,
      tool_input: { plan: args.plan },
    };
    child.stdin.write(`${JSON.stringify(payload)}\n`);
    child.stdin.end();

    const baseUrl = await waitForServerUrl(() => stderr);

    const planRes = await fetch(`${baseUrl}/api/plan`);
    const planJson = (await planRes.json()) as { version: number; history: string[] };

    if (args.decision === "approve") {
      await fetch(`${baseUrl}/api/approve`, { method: "POST" });
    } else {
      await fetch(`${baseUrl}/api/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations: [] }),
      });
    }

    const exitCode = await childExit;

    if (exitCode !== 0) {
      throw new Error(`Session exited with code ${exitCode}. stderr:\n${stderr}`);
    }

    const output = JSON.parse(stdout.trim()) as {
      hookSpecificOutput: { decision: { behavior: "allow" | "deny" } };
    };

    return {
      version: planJson.version,
      history: planJson.history,
      outputBehavior: output.hookSpecificOutput.decision.behavior,
    };
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([childExit.catch(() => -1), Bun.sleep(1000)]);
      if (child.exitCode === null) {
        child.kill("SIGKILL");
        await childExit.catch(() => -1);
      }
    }
  }
}

describe("stdout immediacy", () => {
  test("hook output arrives on stdout before process exits", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-annotator-stdout-"));
    const fakeBin = join(tempRoot, "bin");
    const configHome = join(tempRoot, "config");

    try {
      mkdirSync(fakeBin, { recursive: true });
      mkdirSync(configHome, { recursive: true });
      seedUpdateCheckCache(configHome);

      for (const name of ["open", "xdg-open", "cmd"]) {
        const shimPath = join(fakeBin, name);
        writeFileSync(shimPath, "#!/bin/sh\nexit 0\n", "utf8");
        chmodSync(shimPath, 0o755);
      }

      const hookEvent = {
        transcript_path: "/tmp/stdout-test.jsonl",
        session_id: "session-stdout",
        cwd: "/repo",
        permission_mode: "acceptEdits",
        hook_event_name: "PermissionRequest",
        tool_name: "Write",
        tool_use_id: "tool-stdout",
      };

      // Use a long shutdown delay — stdout must arrive well before this expires
      const shutdownDelayMs = 8000;
      const env = {
        NODE_ENV: "test",
        XDG_CONFIG_HOME: configHome,
        SHUTDOWN_DELAY_MS: String(shutdownDelayMs),
        PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ""}`,
      };

      const child = spawn(process.execPath, ["run", "server/index.ts"], {
        cwd: join(import.meta.dir, ".."),
        env: { ...process.env, ...env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let stdoutReceivedAt: number | null = null;

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
        if (!stdoutReceivedAt && stdout.includes("hookSpecificOutput")) {
          stdoutReceivedAt = Date.now();
        }
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      const childExit = new Promise<number>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => resolve(code ?? -1));
      });

      const payload = { ...hookEvent, tool_input: { plan: "Stdout timing test" } };
      child.stdin.write(`${JSON.stringify(payload)}\n`);
      child.stdin.end();

      // Wait for the server to be ready
      const baseUrl = await waitForServerUrl(() => stderr);
      const decisionSentAt = Date.now();

      // Send approval
      await fetch(`${baseUrl}/api/approve`, { method: "POST" });

      // Wait for stdout to arrive (should be almost immediate, not after shutdown delay)
      const stdoutDeadline = Date.now() + 3000;
      while (!stdoutReceivedAt && Date.now() < stdoutDeadline) {
        await Bun.sleep(25);
      }

      expect(stdoutReceivedAt).not.toBeNull();

      const latencyMs = stdoutReceivedAt! - decisionSentAt;

      // stdout must arrive in under 2 seconds — well before the 8s shutdown delay
      expect(latencyMs).toBeLessThan(2000);

      // Verify it's valid hook output
      const output = JSON.parse(stdout.trim());
      expect(output.hookSpecificOutput.decision.behavior).toBe("allow");

      // Clean up: kill the process (it would otherwise wait for the shutdown delay)
      child.kill("SIGTERM");
      await Promise.race([childExit.catch(() => -1), Bun.sleep(1000)]);
      if (child.exitCode === null) {
        child.kill("SIGKILL");
        await childExit.catch(() => -1);
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 15000);
});

describe("history lifecycle", () => {
  test("deny preserves history and approve clears it while version increments", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-annotator-test-"));
    const fakeBin = join(tempRoot, "bin");
    const configHome = join(tempRoot, "config");

    try {
      mkdirSync(fakeBin, { recursive: true });
      mkdirSync(configHome, { recursive: true });
      seedUpdateCheckCache(configHome);

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

      const hookEvent = {
        transcript_path: "/tmp/shared-plan-history.jsonl",
        session_id: "session-abc",
        cwd: "/repo",
        permission_mode: "acceptEdits",
        hook_event_name: "PermissionRequest",
        tool_name: "Write",
        tool_use_id: "tool-1",
      };

      const historyKey = resolveHistoryKey(hookEvent);
      const historyDir = join(configHome, "open-plan-annotator", "history", historyKey);
      const env = {
        NODE_ENV: "test",
        XDG_CONFIG_HOME: configHome,
        SHUTDOWN_DELAY_MS: "100",
        PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ""}`,
      };

      const run1 = await runSession({ decision: "deny", plan: "Plan v1", env, hookEvent });
      expect(run1.version).toBe(1);
      expect(run1.history).toEqual([]);
      expect(run1.outputBehavior).toBe("deny");

      expect(existsSync(historyDir)).toBe(true);
      expect(readdirSync(historyDir).sort()).toEqual(["v1.md"]);
      expect(readFileSync(join(historyDir, "v1.md"), "utf8")).toBe("Plan v1");

      const run2 = await runSession({ decision: "deny", plan: "Plan v2", env, hookEvent });
      expect(run2.version).toBe(2);
      expect(run2.history).toEqual(["Plan v1"]);
      expect(run2.outputBehavior).toBe("deny");

      expect(readdirSync(historyDir).sort()).toEqual(["v1.md", "v2.md"]);
      expect(readFileSync(join(historyDir, "v2.md"), "utf8")).toBe("Plan v2");

      const run3 = await runSession({ decision: "approve", plan: "Plan v3", env, hookEvent });
      expect(run3.version).toBe(3);
      expect(run3.history).toEqual(["Plan v1", "Plan v2"]);
      expect(run3.outputBehavior).toBe("allow");

      expect(existsSync(historyDir)).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 30000);
});
