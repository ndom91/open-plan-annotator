import fs from "node:fs";

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function shouldSkipHook(env = process.env) {
  const skipFile = env.OPEN_PLAN_ANNOTATOR_SKIP_FILE;
  return Boolean(skipFile) && fs.existsSync(skipFile);
}
