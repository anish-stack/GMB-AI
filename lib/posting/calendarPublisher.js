import { query, one, update } from "../db.js";
import { getSettings } from "../saas/settings.js";
import { TASK_STATUS } from "../constants.js";
import { DEFAULT_POST_TIME } from "./calendarImport.js";

/**
 * Calendar auto-post: every calendar entry goes live on Google at its date + time
 * (default 05:00, APP_TIMEZONE) - no approval, no quality-score gate, no per-client switch.
 *
 *   1. PREPARE  entries due within the next 3 hours that have no post yet -> AI writes them now
 *   2. PUBLISH  entries whose time has come -> publish the post (writes it first if still missing)
 *
 * Only the platform admin can switch it off (Web settings -> "Calendar auto-post").
 * A post the team REJECTED is never published. Each entry is claimed with a conditional
 * UPDATE so two runs can never publish the same entry twice. Runs every 2 minutes (scheduler).
 */
const TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";
const AHEAD_MIN = Number(process.env.CALENDAR_PREPARE_MINUTES || 180);
const LOOKBACK_DAYS = 2; // older missed slots are left alone (shown as missed in the calendar)

function localParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t)?.value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}

/** "YYYY-MM-DD HH:MM" strings compare correctly as text. */
const stamp = (p) => `${p.date} ${p.time}`;
const slot = `CONCAT(DATE_FORMAT(c.scheduled_date,'%Y-%m-%d'),' ',COALESCE(NULLIF(c.scheduled_time,''),'${DEFAULT_POST_TIME}'))`;

export async function calendarAutopostEnabled() {
  const s = await getSettings({ fresh: true });
  return Number(s.calendar_autopost ?? 1) === 1;
}

async function notify(tenantId, type, title, body, link) {
  const { sendNotification } = await import("../notifications/service.js");
  await sendNotification({ tenantId, type, title, body, link, push: type === "ALERT" }).catch(() => {});
}

/** Latest non-rejected task of a calendar entry. */
async function taskFor(calendarId) {
  return one(
    `SELECT id, status FROM ai_tasks WHERE calendar_id=? ORDER BY (status='PUBLISHED') DESC, id DESC LIMIT 1`,
    [calendarId],
  );
}

async function writePost(row) {
  const { createTask, runTaskPipeline } = await import("../ai/orchestrator.js");
  const taskId = await createTask({
    clientId: row.client_id,
    calendarId: row.id,
    postType: row.post_type,
    topic: row.topic,
    scheduledDate: String(row.scheduled_date).slice(0, 10),
    scheduledTime: row.scheduled_time || DEFAULT_POST_TIME,
    enforce: false, // the slot was checked against the plan when it was scheduled
    source: "calendar",
  });
  await runTaskPipeline(taskId);
  return one("SELECT id, status FROM ai_tasks WHERE id=?", [taskId]);
}

/** Step 1: write posts a few hours ahead so they are ready at their time. */
export async function prepareUpcoming({ limit = 6 } = {}) {
  const now = localParts();
  const soon = localParts(new Date(Date.now() + AHEAD_MIN * 60000));
  const rows = await query(
    `SELECT c.* FROM content_calendar c
       JOIN clients cl ON cl.id=c.client_id AND cl.active=1
       JOIN tenants t ON t.id=cl.tenant_id AND t.status='ACTIVE'
      WHERE c.status='SCHEDULED'
        AND ${slot} > ? AND ${slot} <= ?
        AND NOT EXISTS (SELECT 1 FROM ai_tasks a WHERE a.calendar_id=c.id)
      ORDER BY ${slot} LIMIT ${Number(limit)}`,
    [stamp(now), stamp(soon)],
  );
  let prepared = 0;
  for (const row of rows) {
    // claim: only one run writes this entry
    const claim = await query("UPDATE content_calendar SET status='PREPARING' WHERE id=? AND status='SCHEDULED'", [row.id]);
    if (!claim.affectedRows) continue;
    try {
      await writePost(row);
      prepared++;
    } catch (err) {
      console.error(`[calendar] prepare ${row.id}:`, err.message);
    } finally {
      // back to SCHEDULED unless the pipeline already moved it on (GENERATED)
      await query("UPDATE content_calendar SET status='SCHEDULED' WHERE id=? AND status='PREPARING'", [row.id]);
    }
  }
  return prepared;
}

/** Step 2: publish everything whose time has come. */
export async function publishDue({ limit = 20 } = {}) {
  const { publishTask } = await import("../repo/tasks.js");
  const now = localParts();
  const from = localParts(new Date(Date.now() - LOOKBACK_DAYS * 86400000));
  const rows = await query(
    `SELECT c.*, cl.business_name FROM content_calendar c
       JOIN clients cl ON cl.id=c.client_id AND cl.active=1
       JOIN tenants t ON t.id=cl.tenant_id AND t.status='ACTIVE'
      WHERE c.status IN ('SCHEDULED','GENERATED')
        AND ${slot} <= ? AND c.scheduled_date >= ?
      ORDER BY ${slot} LIMIT ${Number(limit)}`,
    [stamp(now), from.date],
  );
  const out = { due: rows.length, published: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    const claim = await query("UPDATE content_calendar SET status='PUBLISHING' WHERE id=? AND status IN ('SCHEDULED','GENERATED')", [row.id]);
    if (!claim.affectedRows) continue;
    let finalStatus = "PUBLISH_FAILED";
    let task = null;
    try {
      task = await taskFor(row.id);
      if (task?.status === TASK_STATUS.PUBLISHED) {
        finalStatus = "PUBLISHED";
        out.skipped++;
        continue;
      }
      if (task?.status === TASK_STATUS.REJECTED) {
        finalStatus = "SKIPPED"; // the team rejected this post - never publish it
        out.skipped++;
        continue;
      }
      const busy = [TASK_STATUS.PENDING, TASK_STATUS.RESEARCHING, TASK_STATUS.KEYWORD_RESEARCH, TASK_STATUS.GENERATING, TASK_STATUS.IMAGE_GENERATING, TASK_STATUS.QA_RUNNING];
      if (task && busy.includes(task.status)) {
        finalStatus = row.status; // still being written - try again next run
        out.skipped++;
        continue;
      }
      if (!task || task.status === TASK_STATUS.FAILED) task = await writePost(row);
      if (![TASK_STATUS.READY_FOR_REVIEW, TASK_STATUS.NEEDS_REVIEW, TASK_STATUS.APPROVED].includes(task?.status)) {
        throw new Error(`The AI could not write this post (status ${task?.status || "none"}).`);
      }
      // no checks: whatever the AI wrote goes live
      if (task.status !== TASK_STATUS.APPROVED) await update("ai_tasks", task.id, { status: TASK_STATUS.APPROVED });
      await publishTask(task.id, { name: "Calendar auto-post", role: "OWNER", userId: null }, row.tenant_id);
      await update("ai_tasks", task.id, { auto_published: 1 });
      finalStatus = "PUBLISHED";
      out.published++;
      await notify(row.tenant_id, "SUCCESS", `Posted on Google - ${row.business_name}`, `Calendar post for ${String(row.scheduled_date).slice(0, 10)} ${row.scheduled_time || DEFAULT_POST_TIME} is live.`, `/gmb/tasks/${task.id}`);
    } catch (err) {
      out.failed++;
      console.error(`[calendar] publish ${row.id}:`, err.message);
      await notify(row.tenant_id, "ALERT", `Auto-post failed - ${row.business_name}`, String(err.message).slice(0, 180), task ? `/gmb/tasks/${task.id}` : "/gmb/calendar");
    } finally {
      await update("content_calendar", row.id, { status: finalStatus });
    }
  }
  return out;
}

export async function runCalendarPublisher() {
  if (!(await calendarAutopostEnabled())) return { disabled: true };
  const published = await publishDue();
  const prepared = await prepareUpcoming();
  return { ...published, prepared };
}
