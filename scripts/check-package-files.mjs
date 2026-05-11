#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const packages = [
  {
    cwd: ".",
    requiredPaths: [
      "bin/open-plan-annotator.mjs",
      "scripts/install-runtime.mjs",
      "hooks/hooks.json",
      "shared/runtimeResolver.mjs",
      "shared/cliHelp.mjs",
      "shared/cliMode.mjs",
      "shared/planReview.mjs",
      "shared/piExtension.mjs",
    ],
  },
  {
    cwd: "packages/pi-extension",
    requiredPaths: ["extensions/index.js", "README.md"],
  },
];

function fail(message) {
  console.error(`check-package-files: ${message}`);
  process.exit(1);
}

for (const pkg of packages) {
  let packOutput;

  try {
    packOutput = execFileSync("npm", ["pack", "--dry-run", "--json"], {
      encoding: "utf8",
      cwd: pkg.cwd,
    });
  } catch (error) {
    fail(`npm pack --dry-run failed in ${pkg.cwd} (${error.message})`);
  }

  let entries;

  try {
    entries = JSON.parse(packOutput);
  } catch {
    fail(`unable to parse npm pack JSON output in ${pkg.cwd}`);
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    fail(`npm pack returned no entries in ${pkg.cwd}`);
  }

  const files = Array.isArray(entries[0].files) ? entries[0].files : [];
  const packagedPaths = new Set(files.map((entry) => entry.path));
  const missingPaths = pkg.requiredPaths.filter((requiredPath) => !packagedPaths.has(requiredPath));

  if (missingPaths.length > 0) {
    fail(`missing required packaged files in ${pkg.cwd}: ${missingPaths.join(", ")}`);
  }
}

console.error("check-package-files: package includes required runtime files");
