export function buildUpdateInstructions(options = {}) {
  const host = options.host ?? process.env.OPEN_PLAN_HOST;
  const packageManager = options.packageManager ?? "npm";
  const version = options.version ?? "latest";

  if (host === "opencode") {
    return "Refresh the OpenCode plugin install and restart OpenCode.";
  }

  if (host === "claude-code") {
    return "Refresh the Claude Code plugin or marketplace install and restart Claude Code.";
  }

  if (packageManager === "pnpm") {
    return `Run \`pnpm i -g open-plan-annotator@${version}\`.`;
  }

  if (packageManager === "bun") {
    return `Run \`bun add -g open-plan-annotator@${version}\`.`;
  }

  return `Run \`npm i -g open-plan-annotator@${version}\`.`;
}
