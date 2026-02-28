/**
 * @typedef {"hook" | "update" | "help" | "version" | "unknown"} CliMode
 */

/**
 * @typedef {{ stdinIsTTY?: boolean }} CliModeOptions
 */

/**
 * @param {string | undefined} arg
 * @param {CliModeOptions} [options]
 * @returns {CliMode}
 */
export function resolveCliMode(arg, options = {}) {
  if (!arg) {
    return options.stdinIsTTY ? "help" : "hook";
  }

  if (arg === "update" || arg === "upgrade") return "update";
  if (arg === "--help" || arg === "-h") return "help";
  if (arg === "--version" || arg === "-v") return "version";
  return "unknown";
}
