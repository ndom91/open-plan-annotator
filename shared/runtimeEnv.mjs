/**
 * @param {{ cliMode: string, baseEnv?: NodeJS.ProcessEnv, packageManager: string }} options
 * @returns {NodeJS.ProcessEnv}
 */
export function buildRuntimeEnv({ cliMode, baseEnv = process.env, packageManager }) {
  const env = {
    ...baseEnv,
    OPEN_PLAN_PKG_MANAGER: packageManager,
  };

  if (!env.OPEN_PLAN_HOST && cliMode === "hook") {
    env.OPEN_PLAN_HOST = "claude-code";
  }

  return env;
}
