#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scratch = mkdtempSync(join(tmpdir(), "open-plan-annotator-pack-"));
let tarball;

function fail(message) {
  console.error(`verify-opencode-plugin-package: ${message}`);
  process.exitCode = 1;
}

try {
  const output = execFileSync("npm", ["pack", "--json", "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8",
  });
  const packed = JSON.parse(output);
  tarball = join(root, packed[0]?.filename ?? "");
  if (!packed[0]?.filename) {
    throw new Error("npm pack did not report a tarball filename");
  }

  execFileSync("tar", ["-xzf", tarball, "-C", scratch]);
  const packageRoot = join(scratch, "package");
  symlinkSync(join(root, "node_modules"), join(packageRoot, "node_modules"), "dir");

  const plugin = await import(`${new URL(`file://${join(packageRoot, "opencode/index.js")}`).href}?packed`);
  if (plugin.default?.id !== "open-plan-annotator" || typeof plugin.default?.setup !== "function") {
    fail("packed default export is not an OpenCode V2 plugin definition (expected id + setup())");
  } else {
    console.error("verify-opencode-plugin-package: packed V2 default export is valid");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (tarball) {
    rmSync(tarball, { force: true });
  }
  rmSync(scratch, { recursive: true, force: true });
}
