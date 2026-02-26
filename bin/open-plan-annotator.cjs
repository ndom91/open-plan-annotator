#!/usr/bin/env node

const { execFileSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const binaryPath = path.join(__dirname, "open-plan-annotator-binary");
const installScript = path.join(__dirname, "..", "install.cjs");

// Buffer stdin immediately so it's not lost if we need to download first.
// Skip when stdin is a TTY (manual invocation) to avoid blocking forever.
let stdinBuffer;
try {
  stdinBuffer = process.stdin.isTTY ? Buffer.alloc(0) : fs.readFileSync(0);
} catch {
  stdinBuffer = Buffer.alloc(0);
}

if (!fs.existsSync(binaryPath)) {
  // Auto-download the binary (handles pnpm blocking postinstall)
  console.error("open-plan-annotator: binary not found, downloading...");
  try {
    execFileSync(process.execPath, [installScript], {
      stdio: ["ignore", 2, "inherit"],
    });
  } catch (e) {
    console.error(
      "\nopen-plan-annotator: failed to download binary.\n" +
      "Try running manually: node " + installScript + "\n"
    );
    process.exit(1);
  }

  if (!fs.existsSync(binaryPath)) {
    console.error(
      "open-plan-annotator: binary still not found after install.\n" +
      "Try running manually: node " + installScript + "\n"
    );
    process.exit(1);
  }
}

// Detect package manager so the binary can suggest the right update command
function detectPackageManager() {
  const ua = process.env.npm_config_user_agent || "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun")) return "bun";
  return "npm";
}

// Spawn the binary with detached so it can outlive this wrapper.
// We pipe stdout to detect the JSON hook output, then forward it and exit
// immediately — the binary keeps its server alive in the background.
const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: ["pipe", "pipe", "inherit"],
  detached: true,
  env: { ...process.env, OPEN_PLAN_PKG_MANAGER: detectPackageManager() },
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
