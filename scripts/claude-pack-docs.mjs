#!/usr/bin/env node

import { copyFileSync, existsSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const claudePath = path.join(rootDir, "CLAUDE.md");
const pluginPath = path.join(rootDir, "CLAUDE.plugin.md");
const backupPath = path.join(rootDir, "CLAUDE.dev.md.bak");

function fail(message) {
  console.error(`claude-pack-docs: ${message}`);
  process.exit(1);
}

function runPrepack() {
  if (!existsSync(pluginPath)) {
    fail("missing CLAUDE.plugin.md; cannot prepare npm package docs");
  }

  if (!existsSync(backupPath)) {
    if (!existsSync(claudePath)) {
      fail("missing CLAUDE.md; expected developer docs before prepack");
    }
    renameSync(claudePath, backupPath);
  }

  copyFileSync(pluginPath, claudePath);
}

function runPostpack() {
  if (!existsSync(backupPath)) {
    return;
  }

  renameSync(backupPath, claudePath);
}

const command = process.argv[2];

if (command === "prepack") {
  runPrepack();
} else if (command === "postpack") {
  runPostpack();
} else {
  fail("usage: node scripts/claude-pack-docs.mjs <prepack|postpack>");
}
