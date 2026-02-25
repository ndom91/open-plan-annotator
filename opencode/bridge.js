import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCAL_BINARY_PATH = join(PKG_ROOT, "bin", "open-plan-annotator-binary");
const INSTALL_SCRIPT = join(PKG_ROOT, "install.cjs");

/** Resolved path to the binary (may differ from LOCAL_BINARY_PATH if found on PATH). */
let BINARY_PATH = LOCAL_BINARY_PATH;

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
 * Check if `open-plan-annotator` is available on PATH.
 * The CLI wrapper handles binary discovery/download and stdin/stdout
 * forwarding, so we can spawn it directly as a fallback when the local
 * binary isn't available (e.g. OpenCode loads the plugin from its own
 * node_modules but the binary only exists in a global pnpm install).
 * @returns {string | undefined}
 */
function findWrapperOnPath() {
  const cmd = process.platform === "win32" ? "where" : "which";
  try {
    const result = execFileSync(cmd, ["open-plan-annotator"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().split("\n")[0];
    return result || undefined;
  } catch {
    return undefined;
  }
}

/** Ensure the compiled binary exists, downloading if necessary. */
function ensureBinary() {
  if (existsSync(LOCAL_BINARY_PATH)) {
    BINARY_PATH = LOCAL_BINARY_PATH;
    return;
  }

  // Try to find node on PATH for running the install script
  try {
    execFileSync(process.execPath, [INSTALL_SCRIPT], {
      cwd: PKG_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    // Retry with "node" explicitly in case process.execPath is bun
    try {
      execFileSync("node", [INSTALL_SCRIPT], {
        cwd: PKG_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      // ignore — we'll check below
    }
  }

  if (existsSync(LOCAL_BINARY_PATH)) {
    BINARY_PATH = LOCAL_BINARY_PATH;
    return;
  }

  // Fallback: use the CLI wrapper from PATH (e.g. global pnpm install).
  // The wrapper handles binary discovery/download and stdio forwarding.
  const wrapperPath = findWrapperOnPath();
  if (wrapperPath) {
    BINARY_PATH = wrapperPath;
    return;
  }

  throw new Error(
    `open-plan-annotator: binary not found at ${LOCAL_BINARY_PATH}. ` +
      `Try running: node ${INSTALL_SCRIPT}`,
  );
}

/**
 * @param {{ plan: string, sessionId?: string, cwd?: string }} options
 */
export async function runPlanReview(options) {
  ensureBinary();

  const payload = buildHookPayload(options);

  const output = await new Promise((resolve, reject) => {
    let cwd = options.cwd ?? process.cwd();

    // Guard: ensure cwd is a directory, not a file
    try {
      if (existsSync(cwd) && !statSync(cwd).isDirectory()) {
        cwd = dirname(cwd);
      }
    } catch {
      cwd = PKG_ROOT;
    }

    // Spawn detached so the binary can outlive this call — it keeps its
    // HTTP server alive for ~10s after emitting the JSON hook response.
    const child = spawn(BINARY_PATH, [], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
      detached: true,
    });

    let stdout = "";
    let stderr = "";
    let resolved = false;

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (resolved) return;

      // Scan for a complete JSON hook-output line.  Once found, resolve
      // immediately and let the binary keep running in the background.
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
          // Not valid hook JSON yet, keep buffering
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
      // Binary exited without producing valid JSON
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

  const decision = /** @type {HookOutput} */ (output).hookSpecificOutput.decision;

  if (decision.behavior === "allow") {
    return { approved: true };
  }

  return {
    approved: false,
    feedback: decision.message,
  };
}