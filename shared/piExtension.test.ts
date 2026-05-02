import { describe, expect, test } from "bun:test";
import packageExtension from "../packages/pi-extension/extensions/index.js";
import { registerPiExtension } from "./piExtension.mjs";

function createMockPi() {
  const tools: Array<{ name: string; label?: string }> = [];
  const commands: Array<{ name: string; description?: string }> = [];

  return {
    pi: {
      registerTool(tool: { name: string; label?: string }) {
        tools.push(tool);
      },
      registerCommand(name: string, command: { description?: string }) {
        commands.push({ name, description: command.description });
      },
    },
    tools,
    commands,
  };
}

describe("piExtension", () => {
  test("registers the submit_plan tool and annotate-plan command", () => {
    const mock = createMockPi();

    registerPiExtension(mock.pi);

    expect(mock.tools.map((tool) => tool.name)).toEqual(["submit_plan"]);
    expect(mock.commands.map((command) => command.name)).toEqual(["annotate-plan"]);
  });

  test("dedicated package entrypoint loads in the workspace", async () => {
    const mock = createMockPi();

    await packageExtension(mock.pi);

    expect(mock.tools.map((tool) => tool.name)).toEqual(["submit_plan"]);
    expect(mock.commands.map((command) => command.name)).toEqual(["annotate-plan"]);
  });
});
