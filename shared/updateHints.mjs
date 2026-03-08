export function buildUpdateInstructions(options = {}) {
  const host = options.host ?? process.env.OPEN_PLAN_HOST;
  const packageManager = options.packageManager ?? "npm";
  const version = options.version ?? "latest";

  if (host === "opencode") {
    return "Refresh the OpenCode plugin install, then restart OpenCode.";
  }

  if (host === "claude-code") {
    return "Refresh the Claude Code plugin or marketplace install, then restart Claude Code.";
  }

  if (packageManager === "pnpm") {
    return `Run \`pnpm i -g open-plan-annotator@${version}\`, then rerun it.`;
  }

  if (packageManager === "bun") {
    return `Run \`bun add -g open-plan-annotator@${version}\`, then rerun it.`;
  }

  return `Run \`npm i -g open-plan-annotator@${version}\`, then rerun it.`;
}
