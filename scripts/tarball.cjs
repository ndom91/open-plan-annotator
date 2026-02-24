#!/usr/bin/env node

const { execFileSync } = require("child_process");
const { existsSync, readdirSync } = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");

if (!existsSync(distDir)) {
  console.error("dist/ not found. Run `bun run build:platforms` first.");
  process.exit(1);
}

const dirs = readdirSync(distDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith("open-plan-annotator-"));

for (const dir of dirs) {
  const tarName = `${dir.name}.tar.gz`;
  console.log(`Creating ${tarName}...`);

  execFileSync("tar", [
    "-czf", path.join(distDir, tarName),
    "-C", distDir,
    dir.name,
  ], { stdio: "inherit" });
}

console.log(`\nCreated ${dirs.length} archives in dist/.`);
console.log("Upload these to the GitHub Release.");
