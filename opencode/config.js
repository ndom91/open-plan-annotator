import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_FILE_NAME = "open-plan-annotator.json";
const DEFAULT_HANDOFF_ENABLED = true;
const DEFAULT_IMPLEMENTATION_AGENT = "build";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readConfigFile(path) {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function resolveConfigBaseDir() {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME?.trim();
  if (xdgConfigHome) {
    return xdgConfigHome;
  }

  const homeDir = homedir()?.trim();
  if (homeDir) {
    return join(homeDir, ".config");
  }

  return undefined;
}

function parseImplementationHandoff(config) {
  if (!isRecord(config)) {
    return {};
  }

  const raw = config.implementationHandoff;
  if (!isRecord(raw)) {
    return {};
  }

  const enabled = typeof raw.enabled === "boolean" ? raw.enabled : undefined;

  let agent;
  if (typeof raw.agent === "string") {
    const trimmed = raw.agent.trim();
    if (trimmed) {
      agent = trimmed;
    }
  }

  return { enabled, agent };
}

export async function resolveImplementationHandoff(directory) {
  const globalConfigDir = resolveConfigBaseDir();
  const globalConfigPath = globalConfigDir ? join(globalConfigDir, "opencode", CONFIG_FILE_NAME) : undefined;
  const projectConfigPath = directory ? join(directory, ".opencode", CONFIG_FILE_NAME) : undefined;

  const globalConfig = globalConfigPath ? parseImplementationHandoff(await readConfigFile(globalConfigPath)) : {};
  const projectConfig = projectConfigPath ? parseImplementationHandoff(await readConfigFile(projectConfigPath)) : {};

  const enabled = projectConfig.enabled ?? globalConfig.enabled ?? DEFAULT_HANDOFF_ENABLED;
  const agent = projectConfig.agent ?? globalConfig.agent ?? DEFAULT_IMPLEMENTATION_AGENT;

  return {
    enabled,
    agent,
    paths: {
      global: globalConfigPath,
      project: projectConfigPath,
    },
  };
}
