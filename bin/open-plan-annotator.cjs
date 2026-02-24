#!/usr/bin/env node

const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const binaryPath = path.join(__dirname, "open-plan-annotator-binary");
const installScript = path.join(__dirname, "..", "install.cjs");

// Buffer stdin immediately so it's not lost if we need to download first
let stdinBuffer;
try {
  stdinBuffer = fs.readFileSync(0);
} catch {
  stdinBuffer = Buffer.alloc(0);
}

if (!fs.existsSync(binaryPath)) {
  // Auto-download the binary (handles pnpm blocking postinstall)
  console.error("open-plan-annotator: binary not found, downloading...");
  try {
    execFileSync(process.execPath, [installScript], {
      stdio: ["ignore", "inherit", "inherit"],
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

try {
  execFileSync(binaryPath, process.argv.slice(2), {
    stdio: ["pipe", "inherit", "inherit"],
    input: stdinBuffer,
  });
} catch (e) {
  process.exit(e.status || 1);
}
