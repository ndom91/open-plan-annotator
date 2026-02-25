#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function resolveTargetRoot() {
  const fromArg = process.argv[2];
  if (fromArg && fromArg.trim().length > 0) {
    return path.resolve(process.cwd(), fromArg);
  }
  const configHome = process.env.XDG_CONFIG_HOME || path.join(require("os").homedir(), ".config");
  return path.join(configHome, "opencode", "plugins");
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

  // Install plugin dependencies using the first available package manager
  const { execFileSync } = require("child_process");
  const packageManagers = [
    { cmd: "bun", args: ["install"] },
    { cmd: "pnpm", args: ["install"] },
    { cmd: "npm", args: ["install"] },
  ];

  let installed = false;
  for (const pm of packageManagers) {
    try {
      execFileSync(pm.cmd, pm.args, { cwd: destinationDir, stdio: "inherit" });
      installed = true;
      break;
    } catch {
      // Try the next package manager
    }
  }

  if (!installed) {
    console.log(
      "open-plan-annotator: could not install dependencies automatically. Run `npm install` in:",
      destinationDir,
    );
  }

  // Create wrapper shim at plugins/open-plan-annotator.ts for OpenCode auto-discovery
  // OpenCode scans plugins/*.{ts,js} but not subdirectories
  const shimPath = path.join(targetRoot, "open-plan-annotator.ts");
  fs.writeFileSync(
    shimPath,
    `export { default } from "./open-plan-annotator/index.ts";\n`,
  );
  console.log(`open-plan-annotator: created loader shim at ${shimPath}`);

  console.log(
    "\nThe plugin will be auto-discovered by OpenCode — no config changes needed.",
  );
}

main();
