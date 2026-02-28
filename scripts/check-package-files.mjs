#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const requiredPaths = [
  "bin/open-plan-annotator.mjs",
  "install.mjs",
  "shared/releaseAssets.mjs",
  "shared/releaseAssets.d.ts",
];

function fail(message) {
  console.error(`check-package-files: ${message}`);
  process.exit(1);
}

let packOutput;

try {
  packOutput = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
  });
} catch (error) {
  fail(`npm pack --dry-run failed (${error.message})`);
}

let entries;

try {
  entries = JSON.parse(packOutput);
} catch {
  fail("unable to parse npm pack JSON output");
}

if (!Array.isArray(entries) || entries.length === 0) {
  fail("npm pack returned no entries");
}

const files = Array.isArray(entries[0].files) ? entries[0].files : [];
const packagedPaths = new Set(files.map((entry) => entry.path));
const missingPaths = requiredPaths.filter((requiredPath) => !packagedPaths.has(requiredPath));

if (missingPaths.length > 0) {
  fail(`missing required packaged files: ${missingPaths.join(", ")}`);
}

console.error("check-package-files: package includes required runtime files");
