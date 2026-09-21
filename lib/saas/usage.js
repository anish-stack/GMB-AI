import { query, one } from "../db.js";
import { METRICS } from "./constants.js";

export function currentPeriod(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function incrementUsage(tenantId, metric, by = 1, period = null) {
  if (!tenantId) return;
  const p = period || currentPeriod();
  await query(
    `INSERT INTO usage_counters (tenant_id, period, metric, used) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE used = used + VALUES(used)`,
    [tenantId, p, metric, Number(by) || 0]
  );
}

export async function getUsage(tenantId, period = null) {
  const p = period || currentPeriod();
  const rows = await query(
    "SELECT metric, used FROM usage_counters WHERE tenant_id=? AND period=?",
    [tenantId, p]
  );
  const out = { period: p };
  for (const m of Object.values(METRICS)) out[m] = 0;
  for (const r of rows) out[r.metric] = Number(r.used);
  return out;
}

/** Live counts that are not month-scoped (clients, team, profiles). */
export async function getLiveCounts(tenantId) {
  const row = await one(
    `SELECT
       (SELECT COUNT(*) FROM clients WHERE tenant_id=? AND active=1) AS clients,
       (SELECT COUNT(*) FROM users WHERE tenant_id=? AND active=1) AS team_members,
       (SELECT COUNT(*) FROM gmb_profiles WHERE tenant_id=?) AS gmb_profiles,
       (SELECT COUNT(*) FROM content_calendar WHERE tenant_id=? AND status='SCHEDULED' AND scheduled_date >= CURDATE()) AS scheduled_posts`,
    [tenantId, tenantId, tenantId, tenantId]
  );
  return {
    clients: Number(row?.clients || 0),
    team_members: Number(row?.team_members || 0),
    gmb_profiles: Number(row?.gmb_profiles || 0),
    scheduled_posts: Number(row?.scheduled_posts || 0),
  };
}

export async function usageHistory(tenantId, months = 6) {
  return query(
    `SELECT period, metric, used FROM usage_counters
      WHERE tenant_id=? ORDER BY period DESC LIMIT ${Number(months) * 6}`,
    [tenantId]
  );
}

export async function platformUsage(period = null) {
  const p = period || currentPeriod();
  return query(
    `SELECT u.tenant_id, t.name AS tenant_name,
            SUM(CASE WHEN metric='posts_generated' THEN used ELSE 0 END) AS posts_generated,
            SUM(CASE WHEN metric='posts_published' THEN used ELSE 0 END) AS posts_published,
            SUM(CASE WHEN metric='ai_calls' THEN used ELSE 0 END) AS ai_calls,
            SUM(CASE WHEN metric='credits' THEN used ELSE 0 END) AS credits
       FROM usage_counters u JOIN tenants t ON t.id=u.tenant_id
      WHERE u.period=?
      GROUP BY u.tenant_id, t.name
      ORDER BY credits DESC`,
    [p]
  );
}
