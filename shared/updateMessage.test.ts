import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { buildUpdateMessage } from "./updateMessage.mjs";

describe("buildUpdateMessage", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns up-to-date status when current matches latest", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ version: "1.2.3" }),
    } as Response);

    await expect(buildUpdateMessage({ currentVersion: "1.2.3", packageManager: "pnpm" })).resolves.toBe(
      "latest v1.2.3; already up to date",
    );
  });

  test("returns exact install command when update is available", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ version: "1.2.4" }),
    } as Response);

    await expect(buildUpdateMessage({ currentVersion: "1.2.3", packageManager: "pnpm" })).resolves.toBe(
      "latest v1.2.4; Run `pnpm i -g open-plan-annotator@1.2.4`.",
    );
  });

  test("returns exact update command for update subcommand", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ version: "1.2.4" }),
    } as Response);

    await expect(buildUpdateMessage({ packageManager: "bun" })).resolves.toBe(
      "Run `bun add -g open-plan-annotator@1.2.4`.",
    );
  });

  test("falls back cleanly when version lookup fails", async () => {
    spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(buildUpdateMessage({ currentVersion: "1.2.3", packageManager: "npm" })).resolves.toBe(
      "latest unknown; Run `npm i -g open-plan-annotator@latest`.",
    );
  });
});
