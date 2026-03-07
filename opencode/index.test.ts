import { afterEach, describe, expect, mock, test } from "bun:test";

afterEach(() => {
  mock.restore();
});

function createPluginContext() {
  return {
    directory: process.cwd(),
    client: {
      session: {
        messages: async () => ({ data: [] }),
        prompt: async () => ({ data: null }),
      },
      app: {
        agents: async () => ({ data: [] }),
      },
    },
  };
}

describe("submit_plan tool output", () => {
  test("returns plain text execution instructions after approval", async () => {
    mock.module("./bridge.js", () => ({
      runPlanReview: async () => ({ approved: true }),
    }));

    const { OpenPlanAnnotatorPlugin } = await import(`./index.js?approved-${Date.now()}`);
    const plugin = await OpenPlanAnnotatorPlugin(createPluginContext());

    const result = await plugin.tool.submit_plan.execute({ plan: "# Plan" }, { sessionID: "session-1" });

    expect(typeof result).toBe("string");
    expect(result).toContain("plan_status=approved");
    expect(result).toContain("next_state=EXECUTION");
    expect(result).toContain("Do not call `submit_plan` again");
  });

  test("returns plain text revision instructions after rejection", async () => {
    mock.module("./bridge.js", () => ({
      runPlanReview: async () => ({ approved: false, feedback: "Need rollback steps." }),
    }));

    const { OpenPlanAnnotatorPlugin } = await import(`./index.js?rejected-${Date.now()}`);
    const plugin = await OpenPlanAnnotatorPlugin(createPluginContext());

    const result = await plugin.tool.submit_plan.execute({ plan: "# Plan" }, { sessionID: "session-2" });

    expect(typeof result).toBe("string");
    expect(result).toContain("plan_status=rejected");
    expect(result).toContain("next_state=PLAN_DRAFT");
    expect(result).toContain("Need rollback steps.");
  });
});
