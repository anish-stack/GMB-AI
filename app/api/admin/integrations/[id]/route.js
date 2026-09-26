import { route } from "@/lib/saas/routeKit.js";
import { saveIntegration, testIntegration, listIntegrationsForAdmin } from "@/lib/integrations/store.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

/** PUT { enabled, values: { field: value } } - empty secret keeps the stored one. */
export const PUT = route({ superAdmin: true }, async ({ ctx, request, params }) => {
  const b = await request.json().catch(() => ({}));
  await saveIntegration(params.id, { enabled: b.enabled, values: b.values || {} }, ctx.name);
  await audit(ctx, "INTEGRATION_UPDATED", { entity: "integration", meta: { id: params.id, enabled: b.enabled, fields: Object.keys(b.values || {}) } });
  return { item: (await listIntegrationsForAdmin()).find((i) => i.id === params.id) };
});

/** POST -> test connection with the saved credentials. */
export const POST = route({ superAdmin: true }, async ({ ctx, params }) => {
  const res = await testIntegration(params.id);
  await audit(ctx, "INTEGRATION_TESTED", { entity: "integration", meta: { id: params.id, status: res.status } });
  return { result: res, item: (await listIntegrationsForAdmin()).find((i) => i.id === params.id) };
});
