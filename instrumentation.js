/**
 * Runs once when the Next.js server boots: loads admin-managed integration
 * credentials (encrypted in MySQL) into process.env so every module that
 * reads process.env picks them up.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { hydrateEnvFromIntegrations } = await import("./lib/integrations/store.js");
    await hydrateEnvFromIntegrations({ fresh: true });
  } catch (err) {
    console.error("[boot] integration settings not loaded:", err.message);
  }
}
