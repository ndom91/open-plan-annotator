import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getRuntimePackageName, resolveRuntimeBinary } from "./runtimeResolver.mjs";

describe("runtimeResolver", () => {
  test("maps supported platforms to runtime packages", () => {
    expect(getRuntimePackageName("darwin", "arm64")).toBe("@open-plan-annotator/runtime-darwin-arm64");
    expect(getRuntimePackageName("linux", "x64")).toBe("@open-plan-annotator/runtime-linux-x64");
  });

  test("throws for unsupported platforms", () => {
    expect(() => resolveRuntimeBinary({ platform: "win32", arch: "x64" })).toThrow("Unsupported platform win32-x64");
  });

  test("resolves binary from installed runtime package", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opa-runtime-"));
    const packageRoot = path.join(tempRoot, "node_modules", "@open-plan-annotator", "runtime-linux-x64");
    const binaryPath = path.join(packageRoot, "bin", "open-plan-annotator");

    fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
    fs.writeFileSync(path.join(packageRoot, "package.json"), '{"name":"@open-plan-annotator/runtime-linux-x64"}');
    fs.writeFileSync(binaryPath, "binary");

    const resolved = resolveRuntimeBinary({
      platform: "linux",
      arch: "x64",
      parentUrl: pathToFileURL(path.join(tempRoot, "index.mjs")).href,
    });

    expect(resolved.packageName).toBe("@open-plan-annotator/runtime-linux-x64");
    expect(fs.realpathSync(resolved.binaryPath)).toBe(fs.realpathSync(binaryPath));
  });
});
