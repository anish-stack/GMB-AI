import { query, one, insert, parseJson } from "../db.js";
import { assertCanSchedule } from "./plan.js";

/**
 * Post automation: fills the content calendar from each client's posting plan,
 * so posts get written (nightly AI job) and - with auto-publish on - go live
 * without anyone scheduling them by hand.
 *
 * Runs for clients with auto_schedule=1 (default) and an ACTIVE plan covering
 * `date`. Uses the plan's posting days, or a sensible spread when none are set
 * (3/week -> Mon, Wed, Fri) at 05:00. Never exceeds the plan's weekly / total caps and
 * never doubles up a day that already has a calendar entry or task.
 */
const SPREAD = { 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
const ROTATION = ["Service", "Educational", "Offer", "Local", "Product/Service Highlight", "FAQ", "Awareness", "Seasonal"];

export function planDays(plan) {
  const days = parseJson(plan.posting_days, []);
  if (Array.isArray(days) && days.length) return days.map(Number);
  return SPREAD[Math.min(7, Math.max(1, Number(plan.posts_per_week) || 3))];
}

export async function autoScheduleFromPlans(date, { clientId = null, tenantId = null } = {}) {
  const { getSettings } = await import("../saas/settings.js");
  if ((await getSettings({ fresh: true })).auto_schedule_mode === "manual") return { disabled: "manual mode (Admin -> Web settings)" };
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const params = [date, date];
  let sql = `SELECT c.id client_id, c.tenant_id, p.posts_per_week, p.posting_days
               FROM clients c
               JOIN tenants t ON t.id=c.tenant_id AND t.status='ACTIVE'
               JOIN client_posting_plans p ON p.client_id=c.id AND p.status='ACTIVE' AND p.start_date<=? AND p.end_date>=?
              WHERE c.active=1 AND c.auto_schedule=1`;
  if (clientId) { sql += " AND c.id=?"; params.push(clientId); }
  if (tenantId) { sql += " AND c.tenant_id=?"; params.push(tenantId); }
  const rows = await query(sql, params);
  const out = { checked: rows.length, scheduled: 0, skipped: 0 };
  for (const r of rows) {
    if (!planDays(r).includes(weekday)) continue;
    const busy = await one(
      "SELECT (SELECT COUNT(*) FROM content_calendar WHERE client_id=? AND scheduled_date=?) + (SELECT COUNT(*) FROM ai_tasks WHERE client_id=? AND scheduled_date=? AND status NOT IN ('REJECTED','FAILED')) n",
      [r.client_id, date, r.client_id, date],
    );
    if (Number(busy?.n)) { out.skipped++; continue; }
    try {
      await assertCanSchedule(r.client_id, [date]);
    } catch {
      out.skipped++; // weekly / total cap reached or plan expired
      continue;
    }
    const n = (await one("SELECT COUNT(*) n FROM content_calendar WHERE client_id=?", [r.client_id]))?.n || 0;
    await insert("content_calendar", {
      tenant_id: r.tenant_id,
      client_id: r.client_id,
      scheduled_date: date,
      post_type: ROTATION[Number(n) % ROTATION.length],
      topic: null,
      scheduled_time: "05:00",
      source: "auto",
      status: "SCHEDULED",
    });
    out.scheduled++;
  }
  return out;
}
