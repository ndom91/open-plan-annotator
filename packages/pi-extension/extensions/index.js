async function loadRegisterPiExtension() {
  try {
    return await import("open-plan-annotator/shared/piExtension.mjs");
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND" && error?.code !== "MODULE_NOT_FOUND") {
      throw error;
    }

    return await import("../../../shared/piExtension.mjs");
  }
}

export default async function (pi) {
  const { registerPiExtension } = await loadRegisterPiExtension();
  registerPiExtension(pi);
}
