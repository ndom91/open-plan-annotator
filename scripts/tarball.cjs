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

// Generate SHA256 checksum manifest
const crypto = require("crypto");
const fs = require("fs");

const tarballs = readdirSync(distDir).filter((f) => f.endsWith(".tar.gz"));
const checksumLines = [];

for (const tarball of tarballs) {
  const content = fs.readFileSync(path.join(distDir, tarball));
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  checksumLines.push(`${hash}  ${tarball}`);
}

const checksumPath = path.join(distDir, "SHA256SUMS.txt");
fs.writeFileSync(checksumPath, checksumLines.join("\n") + "\n");

console.log(`\nCreated ${dirs.length} archives and SHA256SUMS.txt in dist/.`);
