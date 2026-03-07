export function buildUpdateInstructions(options = {}) {
  const host = options.host ?? process.env.OPEN_PLAN_HOST;
  const packageManager = options.packageManager ?? "npm";

  if (host === "opencode") {
    return "Refresh the OpenCode plugin install, then restart OpenCode.";
  }

  if (host === "claude-code") {
    return "Refresh the Claude Code plugin or marketplace install, then restart Claude Code.";
  }

  return `Update open-plan-annotator via ${packageManager}, then rerun it.`;
}
