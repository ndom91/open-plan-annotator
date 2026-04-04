#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

// Ensure output directories exist
for (const { packageDir } of TARGETS) {
  const outDir = path.join(root, packageDir, "bin");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
}

// Build all targets in parallel
const results = await Promise.allSettled(
  TARGETS.map(async ({ name, target, packageDir }) => {
    const outfile = path.join(root, packageDir, "bin", "open-plan-annotator");
    const relPath = path.relative(root, outfile);
    console.log(`Building ${target} → ${relPath}`);
    const start = performance.now();

    await execFileAsync("bun", [
      "build", entry,
      `--outfile=${outfile}`,
      `--target=${target}`,
      "--compile",
    ], { cwd: root, env: { ...process.env, NODE_ENV: "production" } });

    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`  ✓ ${name} done (${elapsed}s)`);
    return name;
  }),
);

const failures = results.filter((r) => r.status === "rejected");
if (failures.length > 0) {
  for (const f of failures) {
    console.error(`  ✗ Build failed:`, f.reason?.message ?? f.reason);
  }
  process.exit(1);
}

console.log("\nAll platform binaries built.");
