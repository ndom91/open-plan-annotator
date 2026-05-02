import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * @typedef {{
 *   hookSpecificOutput: {
 *     hookEventName: "PermissionRequest",
 *     decision: { behavior: "allow" } | { behavior: "deny", message: string }
 *   }
 * }} HookOutput
 */

/**
 * @param {{ plan: string, sessionId?: string, cwd?: string }} options
 */
export function buildHookPayload(options) {
  return {
    session_id: options.sessionId ?? randomUUID(),
    transcript_path: "",
    cwd: options.cwd ?? process.cwd(),
    permission_mode: "default",
    hook_event_name: "PermissionRequest",
    tool_name: "ExitPlanMode",
    tool_use_id: randomUUID(),
    tool_input: {
      plan: options.plan,
    },
  };
}

/**
 * @param {unknown} value
 * @returns {HookOutput}
 */
export function validateHookOutput(value) {
  if (!value || typeof value !== "object") {
    throw new Error("invalid hook output shape");
  }

  const output = /** @type {HookOutput} */ (value);
  const decision = output?.hookSpecificOutput?.decision;

  if (!decision || typeof decision !== "object" || typeof decision.behavior !== "string") {
    throw new Error("missing decision in hook output");
  }

  if (decision.behavior === "allow") {
    return output;
  }

  if (decision.behavior === "deny" && typeof decision.message === "string") {
    return output;
  }

  throw new Error("unsupported decision payload");
}

/**
 * @param {string} stdoutText
 * @param {string} stderrText
 * @returns {HookOutput}
 */
export function parseHookOutput(stdoutText, stderrText) {
  const trimmed = stdoutText.trim();
  if (!trimmed) {
    const stderr = stderrText.trim();
    throw new Error(
      stderr
        ? `open-plan-annotator returned empty stdout; stderr: ${stderr}`
        : "open-plan-annotator returned empty stdout",
    );
  }

  try {
    return validateHookOutput(JSON.parse(trimmed));
  } catch {
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .reverse();

    for (const line of lines) {
      try {
        return validateHookOutput(JSON.parse(line));
      } catch {
        // keep searching
      }
    }

    throw new Error("open-plan-annotator returned invalid hook JSON");
  }
}

/**
 * @param {string | undefined} cwd
 */
function resolveSpawnCwd(cwd) {
  let resolvedCwd = cwd ?? process.cwd();

  try {
    if (existsSync(resolvedCwd) && !statSync(resolvedCwd).isDirectory()) {
      resolvedCwd = dirname(resolvedCwd);
    }
  } catch {
    resolvedCwd = PKG_ROOT;
  }

  return resolvedCwd;
}

/**
 * @param {{
 *   binaryPath: string,
 *   plan: string,
 *   sessionId?: string,
 *   cwd?: string,
 *   env?: Record<string, string | undefined>,
 *   detached?: boolean,
 * }} options
 * @returns {Promise<HookOutput>}
 */
export async function runPlanReviewBinary(options) {
  const payload = buildHookPayload({ plan: options.plan, sessionId: options.sessionId, cwd: options.cwd });
  const cwd = resolveSpawnCwd(options.cwd);

  return await new Promise((resolve, reject) => {
    const child = spawn(options.binaryPath, [], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...options.env,
      },
      detached: options.detached ?? true,
    });

    let stdout = "";
    let stderr = "";
    let resolved = false;

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (resolved) return;

      const lines = stdout.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = validateHookOutput(JSON.parse(trimmed));
          resolved = true;
          child.unref();
          resolve(parsed);
          return;
        } catch {
          // Not JSON yet
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      if (!resolved) reject(error);
    });

    child.on("close", (code, signal) => {
      if (resolved) return;

      if (signal) {
        reject(
          new Error(
            stderr.trim()
              ? `open-plan-annotator was terminated by signal ${signal}: ${stderr.trim()}`
              : `open-plan-annotator was terminated by signal ${signal}`,
          ),
        );
      } else if (code !== 0) {
        reject(
          new Error(
            stderr.trim()
              ? `open-plan-annotator exited with code ${code}: ${stderr.trim()}`
              : `open-plan-annotator exited with code ${code}`,
          ),
        );
      } else {
        reject(new Error("open-plan-annotator exited without producing hook output"));
      }
    });

    child.stdin.write(`${JSON.stringify(payload)}\n`);
    child.stdin.end();
  });
}
