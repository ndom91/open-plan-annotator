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
  autoCloseOnSubmit: boolean;
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
  beforeDecision?: (baseUrl: string) => Promise<void>;
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
    const planJson = (await planRes.json()) as {
      version: number;
      history: string[];
      preferences?: { autoCloseOnSubmit?: boolean };
    };

    if (args.beforeDecision) {
      await args.beforeDecision(baseUrl);
    }

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
      autoCloseOnSubmit: planJson.preferences?.autoCloseOnSubmit ?? false,
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

describe("history lifecycle", () => {
  test("deny preserves history and approve clears it while version increments", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-annotator-test-"));
    const fakeBin = join(tempRoot, "bin");
    const configHome = join(tempRoot, "config");

    try {
      mkdirSync(fakeBin, { recursive: true });
      mkdirSync(configHome, { recursive: true });

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
        PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ""}`,
      };

      const run1 = await runSession({ decision: "deny", plan: "Plan v1", env, hookEvent });
      expect(run1.version).toBe(1);
      expect(run1.history).toEqual([]);
      expect(run1.outputBehavior).toBe("deny");
      expect(run1.autoCloseOnSubmit).toBe(false);

      expect(existsSync(historyDir)).toBe(true);
      expect(readdirSync(historyDir).sort()).toEqual(["v1.md"]);
      expect(readFileSync(join(historyDir, "v1.md"), "utf8")).toBe("Plan v1");

      const run2 = await runSession({ decision: "deny", plan: "Plan v2", env, hookEvent });
      expect(run2.version).toBe(2);
      expect(run2.history).toEqual(["Plan v1"]);
      expect(run2.outputBehavior).toBe("deny");
      expect(run2.autoCloseOnSubmit).toBe(false);

      expect(readdirSync(historyDir).sort()).toEqual(["v1.md", "v2.md"]);
      expect(readFileSync(join(historyDir, "v2.md"), "utf8")).toBe("Plan v2");

      const run3 = await runSession({ decision: "approve", plan: "Plan v3", env, hookEvent });
      expect(run3.version).toBe(3);
      expect(run3.history).toEqual(["Plan v1", "Plan v2"]);
      expect(run3.outputBehavior).toBe("allow");
      expect(run3.autoCloseOnSubmit).toBe(false);

      expect(existsSync(historyDir)).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 30000);

  test("persists auto-close preference across sessions", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-annotator-test-"));
    const fakeBin = join(tempRoot, "bin");
    const configHome = join(tempRoot, "config");

    try {
      mkdirSync(fakeBin, { recursive: true });
      mkdirSync(configHome, { recursive: true });

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
        transcript_path: "/tmp/shared-preferences.jsonl",
        session_id: "session-pref",
        cwd: "/repo",
        permission_mode: "acceptEdits",
        hook_event_name: "PermissionRequest",
        tool_name: "Write",
        tool_use_id: "tool-pref",
      };

      const preferencesPath = join(configHome, "open-plan-annotator", "preferences.json");

      const env = {
        NODE_ENV: "test",
        XDG_CONFIG_HOME: configHome,
        PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ""}`,
      };

      const firstRun = await runSession({
        decision: "approve",
        plan: "Plan with preferences v1",
        env,
        hookEvent,
        beforeDecision: async (baseUrl) => {
          const updateRes = await fetch(`${baseUrl}/api/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ autoCloseOnSubmit: true }),
          });

          expect(updateRes.ok).toBe(true);

          const invalidRes = await fetch(`${baseUrl}/api/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ autoCloseOnSubmit: "yes" }),
          });

          expect(invalidRes.status).toBe(400);
        },
      });

      expect(firstRun.autoCloseOnSubmit).toBe(false);
      expect(firstRun.outputBehavior).toBe("allow");
      expect(existsSync(preferencesPath)).toBe(true);
      expect(JSON.parse(readFileSync(preferencesPath, "utf8")) as { autoCloseOnSubmit: boolean }).toEqual({
        autoCloseOnSubmit: true,
      });

      const secondRun = await runSession({
        decision: "approve",
        plan: "Plan with preferences v2",
        env,
        hookEvent,
      });

      expect(secondRun.autoCloseOnSubmit).toBe(true);
      expect(secondRun.outputBehavior).toBe("allow");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 30000);
});
