const REPOSITORY_URL = "https://github.com/ndom91/open-plan-annotator";

const HELP_USAGE_LINES = [
  "open-plan-annotator              Show this help",
  "open-plan-annotator < event.json Run as a Claude Code hook (debug)",
  "open-plan-annotator update       Update the binary to the latest version",
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
 * @param {string | undefined} command
 * @returns {string}
 */
export function buildUnknownCommandPrefix(command) {
  return `open-plan-annotator: unknown command \`${command ?? ""}\``;
}
