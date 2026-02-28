#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TARGETS = [
  { name: "darwin-arm64", target: "bun-darwin-arm64" },
  { name: "darwin-x64", target: "bun-darwin-x64" },
  { name: "linux-x64", target: "bun-linux-x64" },
  { name: "linux-arm64", target: "bun-linux-arm64" },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const entry = path.join(root, "server/index.ts");
const distDir = path.join(root, "dist");

// Verify UI is built first
if (!existsSync(path.join(root, "build/index.html"))) {
  console.error("build/index.html not found. Run `bun run build:ui` first.");
  process.exit(1);
}

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

for (const { name, target } of TARGETS) {
  const outfile = path.join(distDir, `open-plan-annotator-${name}`, "open-plan-annotator");
  const outDir = path.dirname(outfile);

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  console.log(`Building ${target} → dist/open-plan-annotator-${name}/open-plan-annotator`);

  execFileSync("bun", [
    "build", entry,
    `--outfile=${outfile}`,
    `--target=${target}`,
    "--compile",
  ], { stdio: "inherit", cwd: root, env: { ...process.env, NODE_ENV: "production" } });
}

console.log("\nAll platform binaries built.");
console.log("Run `bun run tarball` to create release archives.");
