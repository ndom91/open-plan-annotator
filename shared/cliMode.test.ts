import { describe, expect, test } from "bun:test";
import { resolveCliMode } from "./cliMode.mjs";

describe("resolveCliMode", () => {
  test("returns help for no-arg interactive invocation", () => {
    expect(resolveCliMode(undefined, { stdinIsTTY: true })).toBe("help");
  });

  test("returns hook for no-arg piped invocation", () => {
    expect(resolveCliMode(undefined, { stdinIsTTY: false })).toBe("hook");
  });

  test("defaults no-arg invocation to hook mode", () => {
    expect(resolveCliMode(undefined)).toBe("hook");
  });

  test("treats upgrade as update alias", () => {
    expect(resolveCliMode("upgrade")).toBe("update");
  });

  test("recognizes help and version flags", () => {
    expect(resolveCliMode("--help")).toBe("help");
    expect(resolveCliMode("-h")).toBe("help");
    expect(resolveCliMode("--version")).toBe("version");
    expect(resolveCliMode("-v")).toBe("version");
  });

  test("marks unknown commands explicitly", () => {
    expect(resolveCliMode("noop")).toBe("unknown");
  });
});
