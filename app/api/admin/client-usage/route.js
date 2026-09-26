import { route } from "@/lib/saas/routeKit.js";
import { query } from "@/lib/db";
import { planUsage, extendPlan } from "@/lib/posting/plan.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

/** Every client with plan + posting usage (optionally one tenant). */
export const GET = route({ superAdmin: true }, async ({ request }) => {
  const sp = new URL(request.url).searchParams;
  const tenantId = sp.get("tenant_id") ? Number(sp.get("tenant_id")) : null;
  const q = (sp.get("q") || "").slice(0, 80);
  const where = [];
  const params = [];
  if (tenantId) { where.push("c.tenant_id=?"); params.push(tenantId); }
  if (q) { where.push("(c.business_name LIKE ? OR t.name LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  const clients = await query(
    `SELECT c.id, c.business_name, c.tenant_id, t.name tenant, c.active,
            (SELECT COUNT(*) FROM support_tickets s WHERE s.tenant_id=c.tenant_id AND s.status NOT IN ('RESOLVED','CLOSED')) open_tickets,
            (SELECT COUNT(*) FROM api_keys k WHERE k.tenant_id=c.tenant_id AND k.revoked=0) api_keys,
            (SELECT COALESCE(SUM(requests),0) FROM api_usage_daily u WHERE u.tenant_id=c.tenant_id AND u.day >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) api_requests_30d,
            (SELECT COUNT(*) FROM notifications n WHERE n.tenant_id=c.tenant_id AND n.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) notifications_30d,
            (SELECT MAX(a.created_at) FROM audit_logs a WHERE a.tenant_id=c.tenant_id) last_activity
       FROM clients c JOIN tenants t ON t.id=c.tenant_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY t.name, c.business_name LIMIT 300`,
    params,
  );
  const items = [];
  for (const c of clients) {
    const u = await planUsage(c.id);
    items.push({
      ...c,
      plan_state: u.state,
      plan: u.plan ? { start: u.plan.start_date, end: u.plan.end_date, months: u.plan.duration_months, per_week: u.plan.posts_per_week, total: u.total } : null,
      used: u.used ?? 0,
      remaining: u.remaining ?? 0,
      week: u.week || null,
      counts: u.counts || null,
    });
  }
  return { items };
});

/** POST { action: "extend", client_id, months } */
export const POST = route({ superAdmin: true }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  if (b.action !== "extend") throw Object.assign(new Error("Unknown action"), { status: 400 });
  const c = (await query("SELECT tenant_id FROM clients WHERE id=?", [Number(b.client_id)]))[0];
  if (!c) throw Object.assign(new Error("Client not found"), { status: 404 });
  await extendPlan(Number(b.client_id), b.months, ctx.name);
  await audit({ ...ctx, tenantId: c.tenant_id }, "CLIENT_PLAN_EXTENDED", { entity: "client", entityId: Number(b.client_id), meta: { months: b.months, by: "admin" } });
  return {};
});
