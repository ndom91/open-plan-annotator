#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_SETUP_TEXT } from "../shared/agentSetup.mjs";
import { buildCliHelpText, buildUnknownCommandPrefix, isAgentHelpTopic } from "../shared/cliHelp.mjs";
import { resolveCliMode } from "../shared/cliMode.mjs";
import { codesignFixCommand, ensureValidCodeSignature, hasValidCodeSignature } from "../shared/macosCodesign.mjs";
import { detectPackageManager } from "../shared/packageManager.mjs";
import { resolveRuntimeBinary } from "../shared/runtimeResolver.mjs";
import { buildRuntimeEnv } from "../shared/runtimeEnv.mjs";
import { buildUpdateMessage } from "../shared/updateMessage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version;
const DIAGNOSE_HINT = "Run `open-plan-annotator doctor` to diagnose, or reinstall the plugin.";

const arg = process.argv[2];
const cliMode = resolveCliMode(arg, { stdinIsTTY: process.stdin.isTTY === true });

if (cliMode === "version") {
  console.log(VERSION);
  process.exit(0);
}

if (cliMode === "help") {
  if (isAgentHelpTopic(process.argv[3])) {
    console.log(AGENT_SETUP_TEXT);
    process.exit(0);
  }

  console.log(buildCliHelpText(VERSION));
  process.exit(0);
}

if (cliMode === "agentSetup") {
  console.log(AGENT_SETUP_TEXT);
  process.exit(0);
}

if (cliMode === "doctor") {
  await printDoctor();
  process.exit(0);
}

if (cliMode === "unknown") {
  console.error(buildUnknownCommandPrefix(arg));
  console.error("Run `open-plan-annotator --help` for usage.");
  process.exit(1);
}

// Buffer stdin immediately so it's not lost if we need to download first.
// Skip when stdin is a TTY (manual invocation) to avoid blocking forever.
let stdinBuffer;
if (cliMode === "hook") {
  try {
    stdinBuffer = process.stdin.isTTY ? Buffer.alloc(0) : fs.readFileSync(0);
  } catch {
    stdinBuffer = Buffer.alloc(0);
  }
} else {
  stdinBuffer = Buffer.alloc(0);
}

if (cliMode === "update") {
  console.log(
    await buildUpdateMessage({
      currentVersion: VERSION,
      packageManager: detectPackageManager({ installPath: fileURLToPath(import.meta.url) }),
    }),
  );
  process.exit(0);
}

let runtime;
try {
  runtime = resolveRuntimeBinary({ parentUrl: import.meta.url });
} catch (error) {
  fail(`open-plan-annotator: ${error instanceof Error ? error.message : String(error)}\n${DIAGNOSE_HINT}`, 1);
}

const childEnv = buildRuntimeEnv({
  cliMode,
  packageManager: detectPackageManager({ installPath: fileURLToPath(import.meta.url) }),
});

runRuntime(runtime.binaryPath, { allowResign: process.platform === "darwin" });

/**
 * @param {string} binaryPath
 * @param {{ allowResign: boolean }} options
 */
function runRuntime(binaryPath, { allowResign }) {
  // stderr is piped and forwarded rather than inherited. An inherited fd would
  // stay open in the detached child during its shutdown keepalive, and Claude
  // Code refuses "allow" hook output while the hook's stdio is still open.
  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
    env: childEnv,
  });

  child.stdin.write(stdinBuffer);
  child.stdin.end();

  let stdout = "";
  let forwarded = false;

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  child.stdout.on("data", (chunk) => {
    stdout += chunk;

    if (forwarded) return;

    // Look for a complete JSON line (the hook output)
    const lines = stdout.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        JSON.parse(trimmed);
        // Valid JSON — write directly to fd 1 (bypasses Node stream buffering),
        // detach child, and exit immediately. Exiting closes our ends of the
        // child's pipes, so Claude Code sees end-of-stream right away.
        forwarded = true;
        fs.writeSync(1, `${trimmed}\n`);
        child.unref();
        process.exit(0);
      } catch {
        // Not JSON yet, keep buffering
      }
    }
  });

  child.on("close", (code, signal) => {
    if (forwarded) return;

    // macOS SIGKILLs binaries with an invalid code signature on launch.
    if (signal === "SIGKILL" && allowResign && !stdout.trim() && !hasValidCodeSignature(binaryPath)) {
      if (ensureValidCodeSignature(binaryPath)) {
        runRuntime(binaryPath, { allowResign: false });
        return;
      }
    }

    // Binary exited without producing valid JSON — forward whatever we have
    if (stdout.trim()) {
      fs.writeSync(1, stdout);
    }
    fail(describeRuntimeFailure(binaryPath, code, signal), code || 1);
  });

  child.on("error", (err) => {
    fail(
      `open-plan-annotator: failed to spawn runtime ${binaryPath}: ${err.message}. ${DIAGNOSE_HINT}`,
      1,
    );
  });
}

/**
 * Hooks must fail loudly. A non-zero exit other than 2 is a non-blocking error
 * in Claude Code: the plan skips review and nobody notices. Exit 2 blocks the
 * tool call and shows stderr to Claude, which relays the fix to the user.
 *
 * @param {string} message
 * @param {number} nonHookExitCode
 * @returns {never}
 */
function fail(message, nonHookExitCode) {
  console.error(message);
  process.exit(cliMode === "hook" ? 2 : nonHookExitCode);
}

/**
 * @param {string} binaryPath
 * @param {number | null} code
 * @param {NodeJS.Signals | null} signal
 */
function describeRuntimeFailure(binaryPath, code, signal) {
  if (signal === "SIGKILL" && process.platform === "darwin") {
    return (
      `open-plan-annotator: runtime ${binaryPath} was killed by SIGKILL, most likely because of an invalid ` +
      `macOS code signature. Fix it by running: ${codesignFixCommand(binaryPath)} — then retry.`
    );
  }
  const reason = signal ? `was killed by ${signal}` : `exited with code ${code}`;
  return `open-plan-annotator: runtime ${binaryPath} ${reason} without a hook response. ${DIAGNOSE_HINT}`;
}

/**
 * Actually execute the runtime, so a binary that exists but can't launch
 * (e.g. SIGKILLed for an invalid signature) is reported as broken.
 *
 * @param {string} binaryPath
 * @returns {string}
 */
function probeRuntime(binaryPath) {
  try {
    const out = execFileSync(binaryPath, ["--version"], {
      timeout: 5_000,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });
    return `ok (${out.trim()})`;
  } catch (error) {
    const signal = error && typeof error === "object" && "signal" in error ? error.signal : null;
    const status = error && typeof error === "object" && "status" in error ? error.status : null;
    return `FAILED (${signal ? `killed by ${signal}` : `exit code ${status ?? "unknown"}`})`;
  }
}

async function printDoctor() {
  const platformKey = `${process.platform}-${process.arch}`;
  const packageManager = detectPackageManager({ installPath: fileURLToPath(import.meta.url) });
  const latestVersionLine = `update: ${await buildUpdateMessage({ currentVersion: VERSION, packageManager })}`;

  try {
    const runtime = resolveRuntimeBinary({ parentUrl: import.meta.url });
    const lines = [
      `open-plan-annotator v${VERSION}`,
      `platform: ${platformKey}`,
      `runtime package: ${runtime.packageName}`,
      `runtime path: ${runtime.binaryPath}`,
      `runtime: ${probeRuntime(runtime.binaryPath)}`,
    ];
    if (process.platform === "darwin") {
      const valid = hasValidCodeSignature(runtime.binaryPath);
      lines.push(`codesign: ${valid ? "valid" : `INVALID — fix with: ${codesignFixCommand(runtime.binaryPath)}`}`);
    }
    lines.push(latestVersionLine);
    console.log(lines.join("\n"));
  } catch (error) {
    console.log([
      `open-plan-annotator v${VERSION}`,
      `platform: ${platformKey}`,
      `runtime: missing`,
      `error: ${error instanceof Error ? error.message : String(error)}`,
      latestVersionLine,
    ].join("\n"));
  }
}
