#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function resolveTargetRoot() {
  const fromArg = process.argv[2];
  if (fromArg && fromArg.trim().length > 0) {
    return path.resolve(process.cwd(), fromArg);
  }
  return path.resolve(process.cwd(), ".opencode", "plugins");
}

function ensureParentDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function installPlugin(sourceDir, destinationDir) {
  if (fs.existsSync(destinationDir)) {
    fs.rmSync(destinationDir, { recursive: true, force: true });
  }

  try {
    fs.symlinkSync(sourceDir, destinationDir, "dir");
    return "symlink";
  } catch {
    fs.cpSync(sourceDir, destinationDir, { recursive: true });
    return "copy";
  }
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const sourceDir = path.join(projectRoot, "opencode-plugin");
  const targetRoot = resolveTargetRoot();
  const destinationDir = path.join(targetRoot, "open-plan-annotator");

  if (!fs.existsSync(sourceDir)) {
    console.error(`open-plan-annotator: missing opencode-plugin at ${sourceDir}`);
    process.exit(1);
  }

  ensureParentDir(targetRoot);
  const mode = installPlugin(sourceDir, destinationDir);

  console.log(
    `open-plan-annotator: installed OpenCode plugin (${mode}) at ${destinationDir}`,
  );
}

main();
