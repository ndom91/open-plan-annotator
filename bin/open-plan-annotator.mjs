#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCliHelpText, buildUnknownCommandPrefix } from "../shared/cliHelp.mjs";
import { resolveCliMode } from "../shared/cliMode.mjs";
import { detectPackageManager } from "../shared/packageManager.mjs";
import { resolveRuntimeBinary } from "../shared/runtimeResolver.mjs";
import { buildUpdateMessage } from "../shared/updateMessage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version;

const arg = process.argv[2];
const cliMode = resolveCliMode(arg, { stdinIsTTY: process.stdin.isTTY === true });

if (cliMode === "version") {
  console.log(VERSION);
  process.exit(0);
}

if (cliMode === "help") {
  console.log(buildCliHelpText(VERSION));
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
  console.error(`open-plan-annotator: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const child = spawn(runtime.binaryPath, process.argv.slice(2), {
  stdio: ["pipe", "pipe", "inherit"],
  detached: true,
  env: {
    ...process.env,
    OPEN_PLAN_HOST: process.env.OPEN_PLAN_HOST || "claude-code",
    OPEN_PLAN_PKG_MANAGER: detectPackageManager({ installPath: fileURLToPath(import.meta.url) }),
  },
});

child.stdin.write(stdinBuffer);
child.stdin.end();

let stdout = "";
let forwarded = false;

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
      // detach child, and exit immediately.
      forwarded = true;
      fs.writeSync(1, trimmed + "\n");
      child.unref();
      process.exit(0);
    } catch {
      // Not JSON yet, keep buffering
    }
  }
});

child.on("close", (code) => {
  if (!forwarded) {
    // Binary exited without producing valid JSON — forward whatever we have
    if (stdout.trim()) {
      fs.writeSync(1, stdout);
    }
    process.exit(code || 1);
  }
});

child.on("error", (err) => {
  console.error("open-plan-annotator: failed to spawn binary:", err.message);
  process.exit(1);
});

async function printDoctor() {
  const platformKey = `${process.platform}-${process.arch}`;
  const packageManager = detectPackageManager({ installPath: fileURLToPath(import.meta.url) });
  const latestVersionLine = `update: ${await buildUpdateMessage({ currentVersion: VERSION, packageManager })}`;

  try {
    const runtime = resolveRuntimeBinary({ parentUrl: import.meta.url });
    console.log([
      `open-plan-annotator v${VERSION}`,
      `platform: ${platformKey}`,
      `runtime package: ${runtime.packageName}`,
      `runtime path: ${runtime.binaryPath}`,
      latestVersionLine,
    ].join("\n"));
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
