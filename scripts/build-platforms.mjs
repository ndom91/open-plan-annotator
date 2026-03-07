#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TARGETS = [
  { name: "darwin-arm64", target: "bun-darwin-arm64", packageDir: "packages/runtime-darwin-arm64" },
  { name: "darwin-x64", target: "bun-darwin-x64", packageDir: "packages/runtime-darwin-x64" },
  { name: "linux-x64", target: "bun-linux-x64", packageDir: "packages/runtime-linux-x64" },
  { name: "linux-arm64", target: "bun-linux-arm64", packageDir: "packages/runtime-linux-arm64" },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const entry = path.join(root, "server/index.ts");
// Verify UI is built first
if (!existsSync(path.join(root, "build/index.html"))) {
  console.error("build/index.html not found. Run `bun run build:ui` first.");
  process.exit(1);
}

for (const { name, target, packageDir } of TARGETS) {
  const outfile = path.join(root, packageDir, "bin", "open-plan-annotator");
  const outDir = path.dirname(outfile);

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  console.log(`Building ${target} → ${path.relative(root, outfile)}`);

  execFileSync("bun", [
    "build", entry,
    `--outfile=${outfile}`,
    `--target=${target}`,
    "--compile",
  ], { stdio: "inherit", cwd: root, env: { ...process.env, NODE_ENV: "production" } });
}

console.log("\nAll platform binaries built.");
