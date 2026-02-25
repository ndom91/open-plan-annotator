import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const WRAPPER_PATH = fileURLToPath(new URL("../bin/open-plan-annotator.cjs", import.meta.url));

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
function buildHookPayload(options) {
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
 * @param {string} stdoutText
 * @param {string} stderrText
 * @returns {HookOutput}
 */
function parseHookOutput(stdoutText, stderrText) {
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
        // ignore and keep searching
      }
    }

    throw new Error("open-plan-annotator returned invalid hook JSON");
  }
}

/**
 * @param {unknown} value
 * @returns {HookOutput}
 */
function validateHookOutput(value) {
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
 * @param {{ plan: string, sessionId?: string, cwd?: string }} options
 */
export async function runPlanReview(options) {
  const payload = buildHookPayload(options);

  const result = await new Promise((resolve, reject) => {
    const child = spawn(WRAPPER_PATH, [], {
      cwd: options.cwd ?? process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });

    child.stdin.write(`${JSON.stringify(payload)}\n`);
    child.stdin.end();
  });

  const settled =
    /** @type {{ code: number | null, signal: NodeJS.Signals | null, stdout: string, stderr: string }} */ (result);

  if (settled.signal) {
    const errorText = settled.stderr.trim();
    throw new Error(
      errorText
        ? `open-plan-annotator was terminated by signal ${settled.signal}: ${errorText}`
        : `open-plan-annotator was terminated by signal ${settled.signal}`,
    );
  }

  if (settled.code !== 0) {
    const errorText = settled.stderr.trim();
    throw new Error(
      errorText
        ? `open-plan-annotator exited with code ${settled.code}: ${errorText}`
        : `open-plan-annotator exited with code ${settled.code}`,
    );
  }

  const output = parseHookOutput(settled.stdout, settled.stderr);
  const decision = output.hookSpecificOutput.decision;

  if (decision.behavior === "allow") {
    return { approved: true };
  }

  return {
    approved: false,
    feedback: decision.message,
  };
}
