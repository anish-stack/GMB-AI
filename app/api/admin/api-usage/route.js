import { route } from "@/lib/saas/routeKit.js";
import { query } from "@/lib/db";
import { usageSummary } from "@/lib/api/keys.js";
import { resetBuckets, currentWindowUsage } from "@/lib/api/rateLimiter.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export const GET = route({ superAdmin: true }, async ({ request }) => {
  const sp = new URL(request.url).searchParams;
  const tenantId = sp.get("tenant_id") ? Number(sp.get("tenant_id")) : null;
  const keys = await query(
    `SELECT k.id, k.tenant_id, t.name tenant, k.name, k.key_prefix, k.scopes, k.active, k.revoked, k.expires_at, k.last_used_at, k.request_count, k.rate_limit_per_min, k.created_at
       FROM api_keys k JOIN tenants t ON t.id=k.tenant_id ${tenantId ? "WHERE k.tenant_id=?" : ""} ORDER BY k.last_used_at DESC LIMIT 300`,
    tenantId ? [tenantId] : [],
  );
  const live = await currentWindowUsage(tenantId ? `tenant:${tenantId}:` : "");
  return { keys, live, ...(await usageSummary({ tenantId, days: Number(sp.get("days")) || 30 })) };
});

/** POST { action: "reset", tenant_id?, api_key_id? } | { action: "set_limit", api_key_id, rate_limit_per_min } | { action: "disable", api_key_id } */
export const POST = route({ superAdmin: true }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  if (b.action === "reset") {
    const removed = await resetBuckets({ tenantId: b.tenant_id || null, apiKeyId: b.api_key_id || null });
    await audit({ ...ctx, tenantId: b.tenant_id || null }, "RATE_LIMIT_RESET", { meta: { tenant_id: b.tenant_id, api_key_id: b.api_key_id, removed } });
    return { removed };
  }
  if (b.action === "set_limit") {
    const v = b.rate_limit_per_min ? Math.max(1, Math.min(10000, Number(b.rate_limit_per_min))) : null;
    await query("UPDATE api_keys SET rate_limit_per_min=? WHERE id=?", [v, Number(b.api_key_id)]);
    await audit(ctx, "API_KEY_LIMIT_CHANGED", { entity: "api_key", entityId: Number(b.api_key_id), meta: { rate_limit_per_min: v } });
    return {};
  }
  if (b.action === "disable" || b.action === "enable") {
    await query("UPDATE api_keys SET active=? WHERE id=?", [b.action === "enable" ? 1 : 0, Number(b.api_key_id)]);
    await audit(ctx, b.action === "enable" ? "API_KEY_ENABLED" : "API_KEY_DISABLED", { entity: "api_key", entityId: Number(b.api_key_id) });
    return {};
  }
  throw Object.assign(new Error("Unknown action"), { status: 400 });
});
