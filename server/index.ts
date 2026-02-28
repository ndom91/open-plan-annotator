// Embedded at compile time by `bun build --compile`
import embeddedHtml from "../build/index.html" with { type: "text" };
import { createRouter } from "./api.ts";
import { openBrowser } from "./launch.ts";
import { createDecisionController, writeHookDecisionToStdout } from "./runtime/decision.ts";
import { cleanupHistory, loadPlanHistory } from "./runtime/history.ts";
import { loadHtmlContent } from "./runtime/html.ts";
import { parseRuntimeInput } from "./runtime/input.ts";
import { createPreferencesPersister, loadPreferences, resolveRuntimePaths } from "./runtime/preferences.ts";
import type { ServerState } from "./types.ts";
import { checkForUpdate } from "./updateCheck.ts";
import { VERSION } from "./version.ts";

if (process.argv.includes("update")) {
  const { runCliUpdate } = await import("./cliUpdate.ts");
  await runCliUpdate();
  process.exit(0);
}

const isDev = process.env.NODE_ENV === "development";

const runtimeInput = await parseRuntimeInput(isDev).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`open-plan-annotator: ${message}\n`);
  process.exit(1);
});

const { hookEvent, planContent } = runtimeInput;
const { configDir, historyRootDir, preferencesPath } = resolveRuntimePaths();
const preferences = await loadPreferences(preferencesPath);
const persistPreferences = createPreferencesPersister(preferencesPath, configDir);
const decisionController = createDecisionController();
const htmlContent = await loadHtmlContent(embeddedHtml);
const { historyDir, planHistory, planVersion } = await loadPlanHistory(isDev, historyRootDir, hookEvent, planContent);

const state: ServerState = {
  planContent,
  planVersion,
  planHistory,
  preferences,
  htmlContent,
  resolveDecision: decisionController.resolveDecision,
  persistPreferences,
  updateInfo: null,
};

const router = createRouter(state);
const server = Bun.serve({
  port: isDev ? 3847 : 0,
  fetch: router,
});

const url = `http://localhost:${server.port}`;
process.stderr.write(`open-plan-annotator: UI available at ${url}\n`);

const packageManager = process.env.OPEN_PLAN_PKG_MANAGER || "npm";
checkForUpdate(configDir, packageManager)
  .then((info) => {
    state.updateInfo = info;
    if (info.updateAvailable) {
      process.stderr.write(`open-plan-annotator: update available ${info.currentVersion} -> ${info.latestVersion}\n`);
    }
  })
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`open-plan-annotator: update check failed: ${message}\n`);
    state.updateInfo = {
      currentVersion: VERSION,
      latestVersion: null,
      updateAvailable: false,
      selfUpdatePossible: false,
      assetUrl: null,
      assetSha256: null,
      updateCommand: `${packageManager} update open-plan-annotator`,
    };
  });

if (!isDev) {
  openBrowser(url);
}

const decision = await decisionController.decisionPromise;
await cleanupHistory(isDev, decision.approved, historyDir);
await writeHookDecisionToStdout(decision);

const keepAliveMs = Number(process.env.SHUTDOWN_DELAY_MS) || 5000;
await Bun.sleep(keepAliveMs);
server.stop();
