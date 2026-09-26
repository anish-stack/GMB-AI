import { route } from "@/lib/saas/routeKit.js";
import { updateKey, revokeKey, regenerateKey } from "@/lib/api/keys.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

/** { name?, scopes?, active?, expires_at? } */
export const PATCH = route({ permission: "billing.manage" }, async ({ ctx, request, params }) => {
  const b = await request.json().catch(() => ({}));
  const item = await updateKey(ctx.tenantId, params.id, { name: b.name, scopes: b.scopes, active: b.active, expiresAt: b.expires_at });
  await audit(ctx, "API_KEY_UPDATED", { entity: "api_key", entityId: item.id, meta: { active: item.active, scopes: item.scopes } });
  return { item };
});

/** { action: "regenerate" } -> new secret returned once */
export const POST = route({ permission: "billing.manage" }, async ({ ctx, request, params }) => {
  const b = await request.json().catch(() => ({}));
  if (b.action !== "regenerate") throw Object.assign(new Error("Unknown action"), { status: 400 });
  const res = await regenerateKey(ctx.tenantId, params.id);
  await audit(ctx, "API_KEY_REGENERATED", { entity: "api_key", entityId: res.item.id });
  return res;
});

export const DELETE = route({ permission: "billing.manage" }, async ({ ctx, params }) => {
  await revokeKey(ctx.tenantId, params.id);
  await audit(ctx, "API_KEY_REVOKED", { entity: "api_key", entityId: Number(params.id) });
  return {};
});
