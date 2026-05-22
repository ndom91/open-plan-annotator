import { describe, expect, test } from "bun:test";
import { AGENT_SETUP_TEXT } from "./agentSetup.mjs";
import { buildCliHelpText, buildUnknownCommandPrefix, isAgentHelpTopic } from "./cliHelp.mjs";

describe("buildCliHelpText", () => {
  test("builds canonical help text for all entrypoints", () => {
    expect(buildCliHelpText("1.2.3")).toBe(`open-plan-annotator v1.2.3

Usage:
  open-plan-annotator              Show this help
  open-plan-annotator < event.json Run as a Claude Code hook (debug)
  open-plan-annotator review <file> Review a Markdown plan from disk
  open-plan-annotator agent-setup  Print generic agent setup instructions
  open-plan-annotator help agent   Print generic agent setup instructions
  open-plan-annotator doctor       Show resolved runtime details
  open-plan-annotator update       Show package-managed update guidance
  open-plan-annotator upgrade      Alias for update
  open-plan-annotator --version    Print version
  open-plan-annotator --help       Show this help

https://github.com/ndom91/open-plan-annotator`);
  });
});

describe("agent setup help", () => {
  test("recognizes agent help topics", () => {
    expect(isAgentHelpTopic("agent")).toBe(true);
    expect(isAgentHelpTopic("agent-setup")).toBe(true);
    expect(isAgentHelpTopic("review")).toBe(false);
  });

  test("documents generic CLI review workflow", () => {
    expect(AGENT_SETUP_TEXT).toContain('open-plan-annotator review "/absolute/path/to/plan.md"');
    expect(AGENT_SETUP_TEXT).toContain("If the result is approved");
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
