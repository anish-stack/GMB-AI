import { route } from "@/lib/saas/routeKit.js";
import { listKeys, createKey, API_SCOPES } from "@/lib/api/keys.js";
import { usageSummary } from "@/lib/api/keys.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export const GET = route({ permission: "billing.view" }, async ({ ctx }) => ({
  items: await listKeys(ctx.tenantId),
  scopes: API_SCOPES,
  apiAccess: Boolean(ctx.features?.f_api_access),
  usage: await usageSummary({ tenantId: ctx.tenantId, days: 30 }),
}));

/** { name, scopes: [], expires_at? } -> returns the plain key ONCE */
export const POST = route({ permission: "billing.manage" }, async ({ ctx, request }) => {
  if (!ctx.features?.f_api_access) throw Object.assign(new Error("API access is not included in your plan."), { status: 402, code: "PLAN_NO_API" });
  const b = await request.json().catch(() => ({}));
  const res = await createKey(ctx.tenantId, { name: b.name, scopes: b.scopes, expiresAt: b.expires_at || null, userId: ctx.userId });
  await audit(ctx, "API_KEY_CREATED", { entity: "api_key", entityId: res.item.id, meta: { name: res.item.name, scopes: res.item.scopes } });
  return res;
});
