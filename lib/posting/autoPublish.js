import { query, one, update } from "../db.js";
import { publishTask } from "../repo/tasks.js";
import { resolveEntitlements } from "../saas/entitlements.js";
import { getSettings } from "../saas/settings.js";

/**
 * Auto-publish: posts whose AI quality score is >= the client's threshold
 * (min 80) go live on their scheduled date + time without manual approval.
 *
 * Needs ALL of:
 *   - platform switch  auto_publish_enabled (super admin, Web settings)
 *   - plan feature     f_auto_publish (super admin, plans)
 *   - client switch    clients.auto_publish (tenant owner / manager, per GMB)
 * Everything else stays manual. Duplicates and posts with QA issues never auto-publish.
 */
export const AUTO_MIN_SCORE = 80;
const TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";

function nowLocal() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}

export async function autoPublishAllowed(tenantId) {
  const s = await getSettings();
  if (Number(s.auto_publish_enabled ?? 1) !== 1) return { allowed: false, reason: "Disabled by the platform admin" };
  const ent = await resolveEntitlements(tenantId);
  const has = ent?.features?.f_auto_publish ?? ent?.f_auto_publish ?? ent?.plan?.f_auto_publish;
  if (!Number(has)) return { allowed: false, reason: "Not included in your plan" };
  return { allowed: true, reason: null };
}

export async function runAutoPublish({ limit = 50 } = {}) {
  const { date, time } = nowLocal();
  const due = await query(
    `SELECT t.id, t.tenant_id, t.client_id, t.qa_score, t.scheduled_time, c.auto_publish_min_score min_score, c.business_name
       FROM ai_tasks t JOIN clients c ON c.id=t.client_id
      WHERE c.auto_publish=1 AND c.active=1
        AND t.status IN ('READY_FOR_REVIEW','APPROVED')
        AND t.qa_score >= GREATEST(c.auto_publish_min_score, ?)
        AND t.duplicate_of IS NULL
        AND t.scheduled_date <= ?
        AND (t.scheduled_date < ? OR t.scheduled_time IS NULL OR t.scheduled_time <= ?)
      ORDER BY t.scheduled_date, t.scheduled_time LIMIT ${Number(limit)}`,
    [AUTO_MIN_SCORE, date, date, time],
  );
  const result = { checked: due.length, published: 0, skipped: 0, failed: 0 };
  const allowedCache = new Map();
  for (const t of due) {
    if (!allowedCache.has(t.tenant_id)) allowedCache.set(t.tenant_id, (await autoPublishAllowed(t.tenant_id)).allowed);
    if (!allowedCache.get(t.tenant_id)) {
      result.skipped++;
      continue;
    }
    try {
      await publishTask(t.id, { name: "Auto-publish", role: "OWNER", userId: null }, t.tenant_id);
      await update("ai_tasks", t.id, { auto_published: 1 });
      result.published++;
      const { sendNotification } = await import("../notifications/service.js");
      await sendNotification({ tenantId: t.tenant_id, type: "SUCCESS", title: `Auto-published - ${t.business_name}`, body: `QA score ${t.qa_score}/100. The post is live on Google.`, link: `/gmb/tasks/${t.id}`, push: false });
    } catch (err) {
      result.failed++;
      console.error(`[auto-publish] task ${t.id}:`, err.message);
      const { sendNotification } = await import("../notifications/service.js");
      await sendNotification({ tenantId: t.tenant_id, type: "ALERT", title: `Auto-publish failed - ${t.business_name}`, body: String(err.message).slice(0, 160), link: `/gmb/tasks/${t.id}`, push: true }).catch(() => {});
    }
  }
  return result;
}

export async function getAutoPublish(clientId) {
  return one("SELECT auto_publish, auto_publish_min_score FROM clients WHERE id=?", [clientId]);
}
