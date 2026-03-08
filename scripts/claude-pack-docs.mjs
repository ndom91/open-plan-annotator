#!/usr/bin/env bun

import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const claudePath = path.join(rootDir, "CLAUDE.md");
const pluginPath = path.join(rootDir, "CLAUDE.plugin.md");
const backupPath = path.join(rootDir, "CLAUDE.dev.md.bak");
const packageJsonPath = path.join(rootDir, "package.json");
const packageJsonBackupPath = path.join(rootDir, "package.json.pack.bak");

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

  if (!existsSync(packageJsonBackupPath)) {
    copyFileSync(packageJsonPath, packageJsonBackupPath);
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  delete packageJson.packageManager;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function runPostpack() {
  if (!existsSync(backupPath)) {
    if (existsSync(packageJsonBackupPath)) {
      renameSync(packageJsonBackupPath, packageJsonPath);
    }
    return;
  }

  renameSync(backupPath, claudePath);

  if (existsSync(packageJsonBackupPath)) {
    renameSync(packageJsonBackupPath, packageJsonPath);
  }
}

const command = process.argv[2];

if (command === "prepack") {
  runPrepack();
} else if (command === "postpack") {
  runPostpack();
} else {
  fail("usage: bun scripts/claude-pack-docs.mjs <prepack|postpack>");
}
