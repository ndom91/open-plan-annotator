import type { UserPreferences } from "../types.ts";

export const DEFAULT_PREFERENCES: UserPreferences = {
  autoCloseOnSubmit: false,
};

export interface RuntimePaths {
  configDir: string;
  historyRootDir: string;
  preferencesPath: string;
}

export function resolveRuntimePaths(): RuntimePaths {
  const configBase = process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`;
  const configDir = `${configBase}/open-plan-annotator`;
  return {
    configDir,
    historyRootDir: `${configDir}/history`,
    preferencesPath: `${configDir}/preferences.json`,
  };
}

export async function loadPreferences(preferencesPath: string): Promise<UserPreferences> {
  const preferences: UserPreferences = { ...DEFAULT_PREFERENCES };
  try {
    const rawPreferences = await Bun.file(preferencesPath).text();
    const parsed = JSON.parse(rawPreferences) as Partial<UserPreferences>;
    if (typeof parsed.autoCloseOnSubmit === "boolean") {
      preferences.autoCloseOnSubmit = parsed.autoCloseOnSubmit;
    }
  } catch {
    // Keep defaults when no file exists or parsing fails
  }

  return preferences;
}

export function createPreferencesPersister(
  preferencesPath: string,
  configDir: string,
): (nextPreferences: UserPreferences) => Promise<void> {
  return async (nextPreferences: UserPreferences): Promise<void> => {
    const serialized = `${JSON.stringify(nextPreferences, null, 2)}\n`;

    try {
      await Bun.write(preferencesPath, serialized);
      return;
    } catch {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(configDir, { recursive: true });
      await Bun.write(preferencesPath, serialized);
    }
  };
}
