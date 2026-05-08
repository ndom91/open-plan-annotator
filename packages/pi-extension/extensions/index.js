async function loadRegisterPiExtension() {
  // Prefer the workspace-local module so dev edits and tests see the latest
  // source. Falls back to the published `open-plan-annotator` package when the
  // pi-extension is installed standalone (the relative path won't resolve).
  try {
    return await import("../../../shared/piExtension.mjs");
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND" && error?.code !== "MODULE_NOT_FOUND") {
      throw error;
    }

    return await import("open-plan-annotator/shared/piExtension.mjs");
  }
}

export default async function (pi) {
  const { registerPiExtension } = await loadRegisterPiExtension();
  registerPiExtension(pi);
}
