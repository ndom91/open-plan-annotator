#!/usr/bin/env node

const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const binaryPath = path.join(__dirname, "open-plan-annotator-binary");

if (!fs.existsSync(binaryPath)) {
  console.error(
    "open-plan-annotator: binary not found. The postinstall script may have failed.\n" +
    "Try running: node " + path.join(__dirname, "..", "install.cjs")
  );
  process.exit(1);
}

try {
  execFileSync(binaryPath, process.argv.slice(2), { stdio: "inherit" });
} catch (e) {
  process.exit(e.status || 1);
}
