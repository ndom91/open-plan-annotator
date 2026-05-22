const REPOSITORY_URL = "https://github.com/ndom91/open-plan-annotator";

const HELP_USAGE_LINES = [
  "open-plan-annotator              Show this help",
  "open-plan-annotator < event.json Run as a Claude Code hook (debug)",
  "open-plan-annotator review <file> Review a Markdown plan from disk",
  "open-plan-annotator agent-setup  Print generic agent setup instructions",
  "open-plan-annotator help agent   Print generic agent setup instructions",
  "open-plan-annotator doctor       Show resolved runtime details",
  "open-plan-annotator update       Show package-managed update guidance",
  "open-plan-annotator upgrade      Alias for update",
  "open-plan-annotator --version    Print version",
  "open-plan-annotator --help       Show this help",
];

/**
 * @param {string} version
 * @returns {string}
 */
export function buildCliHelpText(version) {
  const usage = HELP_USAGE_LINES.map((line) => `  ${line}`).join("\n");
  return `open-plan-annotator v${version}\n\nUsage:\n${usage}\n\n${REPOSITORY_URL}`;
}

/**
 * @param {string | undefined} topic
 * @returns {boolean}
 */
export function isAgentHelpTopic(topic) {
  return topic === "agent" || topic === "agent-setup";
}

/**
 * @param {string | undefined} command
 * @returns {string}
 */
export function buildUnknownCommandPrefix(command) {
  return `open-plan-annotator: unknown command \`${command ?? ""}\``;
}
