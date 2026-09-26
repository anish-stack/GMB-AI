import { publicApi } from "@/lib/api/public.js";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/v1/me - who this key belongs to + its limits. */
export const GET = publicApi({ scope: null, endpoint: "me" }, async ({ key, tenantId }) => {
  const t = await one(
    `SELECT t.id, t.name, t.status, p.name plan FROM tenants t
       LEFT JOIN subscriptions s ON s.id=(SELECT MAX(id) FROM subscriptions x WHERE x.tenant_id=t.id)
       LEFT JOIN plans p ON p.id=s.plan_id WHERE t.id=?`,
    [tenantId],
  );
  return {
    workspace: { id: t.id, name: t.name, status: t.status, plan: t.plan },
    key: { id: key.id, name: key.name, prefix: key.key_prefix, scopes: String(key.scopes || "").split(","), expires_at: key.expires_at },
  };
});
