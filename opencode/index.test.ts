import { afterEach, describe, expect, mock, test } from "bun:test";

afterEach(() => {
  mock.restore();
});

function createMockEditor() {
  const tools = new Map();
  return {
    tools,
    add(tool) {
      tools.set(tool.name, tool);
    },
    update() {},
    remove() {},
  };
}

function createPluginContext() {
  const editor = createMockEditor();
  const hooks = new Map();
  return {
    ctx: {
      location: { directory: process.cwd() },
      options: {},
      tool: {
        transform: async (callback) => {
          callback(editor);
          return { dispose: async () => {} };
        },
        list: async () => [],
        reload: async () => {},
      },
      session: {
        get: async () => ({ id: "session-1", agent: "plan" }),
        switchAgent: async () => {},
        prompt: async () => ({ id: "inbox-1" }),
        hook: async (name, callback) => {
          hooks.set(name, callback);
          return { dispose: async () => {} };
        },
      },
      agent: {
        list: async () => ({ data: [] }),
        get: async () => ({ data: undefined }),
      },
    },
    editor,
    hooks,
  };
}

async function loadPluginWithBridge(runPlanReviewImpl, suffix) {
  mock.module("./bridge.js", () => ({
    runPlanReview: runPlanReviewImpl,
  }));

  const mod = await import(`./index.js?${suffix}-${Date.now()}`);
  return mod;
}

describe("annotate_plan tool output (V2)", () => {
  test("default export is a V2 plugin definition object", async () => {
    mock.module("./bridge.js", () => ({
      runPlanReview: async () => ({ approved: true }),
    }));
    const mod = await import(`./index.js?shape-${Date.now()}`);
    expect(typeof mod.default).toBe("object");
    expect(mod.default.id).toBe("open-plan-annotator");
    expect(typeof mod.default.setup).toBe("function");
  });

  test("returns plain text execution instructions after approval", async () => {
    const mod = await loadPluginWithBridge(async () => ({ approved: true }), "approved");
    const { ctx, editor } = createPluginContext();
    const cleanup = await mod.default.setup(ctx);
    expect(typeof cleanup === "function" || cleanup === undefined).toBe(true);

    const tool = editor.tools.get("annotate_plan");
    expect(tool).toBeDefined();
    const result = await tool.execute({ plan: "# Plan" }, { sessionID: "session-1" });

    const content = typeof result === "string" ? result : (result.content ?? "");
    expect(content).toContain("plan_status=approved");
    expect(content).toContain("next_state=EXECUTION");
    expect(content).toContain("Do not call `annotate_plan` again");
  });

  test("returns plain text revision instructions after rejection", async () => {
    const mod = await loadPluginWithBridge(
      async () => ({ approved: false, feedback: "Need rollback steps." }),
      "rejected",
    );
    const { ctx, editor } = createPluginContext();
    await mod.default.setup(ctx);

    const tool = editor.tools.get("annotate_plan");
    const result = await tool.execute({ plan: "# Plan" }, { sessionID: "session-2" });

    const content = typeof result === "string" ? result : (result.content ?? "");
    expect(content).toContain("plan_status=rejected");
    expect(content).toContain("next_state=PLAN_DRAFT");
    expect(content).toContain("Need rollback steps.");
  });

  test("injects plan review instructions via session context hook", async () => {
    const mod = await loadPluginWithBridge(async () => ({ approved: true }), "hook");
    const { ctx, hooks } = createPluginContext();
    await mod.default.setup(ctx);

    const hook = hooks.get("context");
    expect(hook).toBeDefined();
    const event = { sessionID: "session-1", system: [] };
    await hook(event);
    expect(event.system.length).toBe(1);
    expect(event.system[0].text).toContain("annotate_plan");

    // does not duplicate when already present
    await hook(event);
    expect(event.system.length).toBe(1);
  });

  test("skips injection for the implementation agent", async () => {
    const mod = await loadPluginWithBridge(async () => ({ approved: true }), "skip-handoff");
    const { ctx, hooks } = createPluginContext();
    ctx.session.get = async () => ({ id: "s", agent: "build" });
    await mod.default.setup(ctx);

    const hook = hooks.get("context");
    const event = { sessionID: "s", system: [] };
    await hook(event);
    expect(event.system.length).toBe(0);
  });
});
