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

describe("submit_plan return schema contract", () => {
  test("approved decision maps to approved execution payload", async () => {
    mock.module("./bridge.js", () => ({
      runPlanReview: async () => ({ approved: true }),
    }));

    const { OpenPlanAnnotatorPlugin } = await import(`./index.js?approved-${Date.now()}`);
    const plugin = await OpenPlanAnnotatorPlugin(createPluginContext());

    const result = await plugin.tool.submit_plan.execute({ plan: "# Plan" }, { sessionID: "session-1" });

    expect(result.plan_status).toBe("approved");
    expect(result.next_state).toBe("EXECUTION");
    expect(result.feedback).toBe("");
    expect(result.guidance).toContain("Plan approved by the user.");
  });

  test("rejected decision maps to plan redraft payload with bridge feedback", async () => {
    const bridgeFeedback = "Need to add rollback steps.";

    mock.module("./bridge.js", () => ({
      runPlanReview: async () => ({ approved: false, feedback: bridgeFeedback }),
    }));

    const { OpenPlanAnnotatorPlugin } = await import(`./index.js?rejected-${Date.now()}`);
    const plugin = await OpenPlanAnnotatorPlugin(createPluginContext());

    const result = await plugin.tool.submit_plan.execute({ plan: "# Plan" }, { sessionID: "session-2" });

    expect(result.plan_status).toBe("rejected");
    expect(result.next_state).toBe("PLAN_DRAFT");
    expect(result.feedback).toBe(bridgeFeedback);
    expect(result.guidance).toContain("## User feedback");
  });

  test("all top-level submit_plan fields are strings for display safety", async () => {
    mock.module("./bridge.js", () => ({
      runPlanReview: async () => ({ approved: true }),
    }));

    const { OpenPlanAnnotatorPlugin } = await import(`./index.js?display-safe-${Date.now()}`);
    const plugin = await OpenPlanAnnotatorPlugin(createPluginContext());

    const result = await plugin.tool.submit_plan.execute(
      { plan: "# Plan", summary: "Short summary" },
      { sessionID: "session-3" },
    );

    for (const value of Object.values(result)) {
      expect(typeof value).toBe("string");
    }

    expect(result).not.toHaveProperty("approved");
  });
});
