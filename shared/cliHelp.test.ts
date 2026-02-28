import { describe, expect, test } from "bun:test";
import { buildCliHelpText, buildUnknownCommandPrefix } from "./cliHelp.mjs";

describe("buildCliHelpText", () => {
  test("builds canonical help text for all entrypoints", () => {
    expect(buildCliHelpText("1.2.3")).toBe(`open-plan-annotator v1.2.3

Usage:
  open-plan-annotator              Show this help
  open-plan-annotator < event.json Run as a Claude Code hook (debug)
  open-plan-annotator update       Update the binary to the latest version
  open-plan-annotator upgrade      Alias for update
  open-plan-annotator --version    Print version
  open-plan-annotator --help       Show this help

https://github.com/ndom91/open-plan-annotator`);
  });
});

describe("buildUnknownCommandPrefix", () => {
  test("formats unknown command prefix consistently", () => {
    expect(buildUnknownCommandPrefix("wat")).toBe("open-plan-annotator: unknown command `wat`");
  });

  test("handles missing command safely", () => {
    expect(buildUnknownCommandPrefix(undefined)).toBe("open-plan-annotator: unknown command ``");
  });
});
