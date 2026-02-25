import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Plugin, tool } from "@opencode-ai/plugin";

function resolveRunner(): { command: string; args: string[] } {
  const moduleDir = dirname(new URL(import.meta.url).pathname);
  const repoRoot = join(moduleDir, "..");
  const sourceServer = join(repoRoot, "server", "index.ts");
  const packageBin = join(repoRoot, "bin", "open-plan-annotator.cjs");
  const projectLocal = join(process.cwd(), "node_modules", ".bin", "open-plan-annotator");

  if (existsSync(sourceServer) && process.env.OPEN_PLAN_ANNOTATOR_FORCE_BINARY !== "1") {
    return { command: "bun", args: ["run", sourceServer] };
  }

  if (existsSync(packageBin)) {
    return { command: process.execPath, args: [packageBin] };
  }

  if (existsSync(projectLocal)) {
    return { command: projectLocal, args: [] };
  }

  return { command: "open-plan-annotator", args: [] };
}

function execAsync(
  command: string,
  args: string[],
  stdinData: string,
): Promise<{ stdout: string; stderr: string; status: number | null }> {
  return new Promise((resolve) => {
    const child = execFile(
      command,
      args,
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          status: error ? 1 : 0,
        });
      },
    );
    if (child.stdin) {
      child.stdin.write(stdinData);
      child.stdin.end();
    }
  });
}

function normalizeOutput(
  stdout: string,
  stderr: string,
  _status: number | null,
): { ok: boolean; decision: string; feedback?: string; message?: string } {
  const text = (stdout ?? "").trim();
  if (!text) {
    return {
      ok: false,
      decision: "deny",
      feedback: stderr || "open-plan-annotator returned empty output",
      message: "Plan changes requested.",
    };
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // fall through
  }

  return {
    ok: false,
    decision: "deny",
    feedback: `Unexpected response from open-plan-annotator: ${text}`,
    message: "Plan changes requested.",
  };
}

const SYSTEM_INSTRUCTIONS = `
## Plan Submission

When you have completed your plan, you MUST call the \`submit_plan\` tool to submit it for user review.
The user will be able to:
- Review your plan visually in a dedicated UI
- Annotate specific sections with feedback
- Approve the plan to proceed with implementation
- Request changes with detailed feedback

If your plan is rejected, you will receive the user's annotated feedback. Revise your plan
based on their feedback and call submit_plan again.

Do NOT proceed with implementation until your plan is approved.

### When to Use Plan Mode

Use plan mode (and submit your plan for review) for any task involving:
- Creating or modifying more than 2 files
- Architectural or structural changes
- Anything the user hasn't explicitly described step-by-step
- Refactoring, migration, or feature additions
- Bug fixes that require investigation

For truly trivial tasks (fix a typo, rename a single variable, answer a factual question), you may skip plan submission.

### Plan Quality Standards

When writing a plan, include:
- A brief summary of what you understood the task to require
- The specific files you intend to create or modify and why
- Any assumptions you are making
- An explicit question if anything is ambiguous
`;

export const OpenPlanAnnotatorPlugin: Plugin = async (_ctx) => {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(SYSTEM_INSTRUCTIONS);
    },

    tool: {
      submit_plan: tool({
        description:
          "Submit your completed plan for interactive user review. The user can annotate, approve, or request changes. Call this when you have finished creating your implementation plan.",
        args: {
          plan: tool.schema.string().describe("The complete implementation plan in markdown format"),
          summary: tool.schema
            .string()
            .optional()
            .describe("A brief 1-2 sentence summary of what the plan accomplishes"),
        },

        async execute(args) {
          const runner = resolveRunner();
          const payload = JSON.stringify({
            host: "opencode",
            command: "submit_plan",
            plan: args.plan,
            cwd: process.cwd(),
          });

          const result = await execAsync(runner.command, runner.args, payload);
          const output = normalizeOutput(result.stdout, result.stderr, result.status);

          if (output.ok && output.decision === "approve") {
            return [
              "Plan approved by the user. You may now proceed with implementation.",
              args.summary ? `\nPlan Summary: ${args.summary}` : "",
            ].join("");
          }

          return [
            "Plan needs revision.",
            "",
            "The user has requested changes to your plan. Please review their feedback below and revise your plan accordingly.",
            "",
            "## User Feedback",
            "",
            output.feedback ?? "Plan changes requested.",
            "",
            "---",
            "",
            "Please revise your plan based on this feedback and call `submit_plan` again when ready.",
          ].join("\n");
        },
      }),
    },
  };
};

export default OpenPlanAnnotatorPlugin;
