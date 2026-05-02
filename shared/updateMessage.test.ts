import { describe, expect, test } from "bun:test";
import { buildUpdateMessage } from "./updateMessage.mjs";

describe("buildUpdateMessage", () => {
  test("returns up-to-date status when current matches latest", async () => {
    await expect(
      buildUpdateMessage({
        currentVersion: "1.2.3",
        packageManager: "pnpm",
        fetchLatestVersion: async () => "1.2.3",
      }),
    ).resolves.toBe("latest v1.2.3; already up to date");
  });

  test("returns exact install command when update is available", async () => {
    await expect(
      buildUpdateMessage({
        currentVersion: "1.2.3",
        packageManager: "pnpm",
        fetchLatestVersion: async () => "1.2.4",
      }),
    ).resolves.toBe("latest v1.2.4; Run `pnpm i -g open-plan-annotator@1.2.4`.");
  });

  test("returns exact update command for update subcommand", async () => {
    await expect(
      buildUpdateMessage({
        packageManager: "bun",
        fetchLatestVersion: async () => "1.2.4",
      }),
    ).resolves.toBe("Run `bun add -g open-plan-annotator@1.2.4`.");
  });

  test("falls back cleanly when version lookup fails", async () => {
    await expect(
      buildUpdateMessage({
        currentVersion: "1.2.3",
        packageManager: "npm",
        fetchLatestVersion: async () => {
          throw new Error("network down");
        },
      }),
    ).resolves.toBe("latest unknown; Run `npm i -g open-plan-annotator@latest`.");
  });
});
