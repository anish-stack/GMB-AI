import { query, one, insert, update, pool } from "../db.js";
import { getSettings } from "../saas/settings.js";

/**
 * CLIENT POSTING PLAN - single source of truth for posting caps.
 *
 * Counting rules (backend + UI use this file only):
 *  - Window: plan start_date .. end_date (inclusive). Weeks are 7-day blocks from start_date.
 *  - A post's date = its scheduled date (else the day it was created).
 *  - COUNTED: every AI task except REJECTED / FAILED, i.e.
 *      processing (PENDING..QA_RUNNING), pending (READY_FOR_REVIEW, NEEDS_REVIEW, APPROVED),
 *      published (PUBLISHED, POST_DELETED - a used slot stays used),
 *    plus calendar slots still SCHEDULED that have not produced a task yet ("scheduled").
 *  - Rejected / failed posts give the slot back.
 */
export const PROCESSING = ["PENDING", "RESEARCHING", "KEYWORD_RESEARCH", "GENERATING", "IMAGE_GENERATING", "QA_RUNNING"];
export const PENDING = ["READY_FOR_REVIEW", "NEEDS_REVIEW", "APPROVED"];
export const PUBLISHED = ["PUBLISHED", "POST_DELETED"];

export class PlanLimitError extends Error {
  constructor(message, code, meta = {}) {
    super(message);
    this.status = 422;
    this.code = code;
    this.meta = meta;
  }
}

export const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
const toDate = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00`);
const fmt = (d) => d.toLocaleDateString("en-CA");
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return fmt(d); };
const dayDiff = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);

/** "approximately 4 weeks a month" - 2 months x 3/week = 24 posts. */
export function approxTotal(months, perWeek) {
  return Math.max(1, Math.round(Number(months) * 4 * Number(perWeek)));
}

export function endDateFor(start, months) {
  const d = toDate(start);
  d.setMonth(d.getMonth() + Number(months));
  d.setDate(d.getDate() - 1);
  return fmt(d);
}

export function normalizePlanInput(input = {}) {
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start_date || "")) ? input.start_date : today();
  const months = Math.min(Math.max(parseInt(input.duration_months, 10) || 1, 1), 60);
  const perWeek = Math.min(Math.max(parseInt(input.posts_per_week, 10) || 3, 1), 21);
  const computed = approxTotal(months, perWeek);
  const total = input.total_posts ? Math.min(Math.max(parseInt(input.total_posts, 10) || computed, 1), 2000) : computed;
  let days = Array.isArray(input.posting_days) ? input.posting_days : String(input.posting_days || "").split(",");
  days = [...new Set(days.map((d) => parseInt(d, 10)).filter((d) => d >= 0 && d <= 6))].sort();
  if (days.length && days.length < Math.min(perWeek, 7)) {
    throw new PlanLimitError(`Pick at least ${perWeek} posting days for ${perWeek} posts per week (or leave days empty).`, "INVALID_PLAN");
  }
  return { start_date: start, duration_months: months, end_date: endDateFor(start, months), posts_per_week: perWeek, total_posts: total, computed_total: computed, posting_days: days.length ? JSON.stringify(days) : null };
}

export async function getPlan(clientId) {
  return one("SELECT * FROM client_posting_plans WHERE client_id=? AND status<>'REPLACED' ORDER BY id DESC LIMIT 1", [clientId]);
}

/** Creates/replaces the client's plan (old one kept as REPLACED history). */
export async function savePlan(clientId, tenantId, input, actor = "system") {
  const p = normalizePlanInput(input);
  await query("UPDATE client_posting_plans SET status='REPLACED' WHERE client_id=? AND status<>'REPLACED'", [clientId]);
  const id = await insert("client_posting_plans", {
    tenant_id: tenantId,
    client_id: clientId,
    start_date: p.start_date,
    duration_months: p.duration_months,
    end_date: p.end_date,
    posts_per_week: p.posts_per_week,
    total_posts: p.total_posts,
    posting_days: p.posting_days,
    status: p.end_date < today() ? "EXPIRED" : "ACTIVE",
    notes: input.notes ? String(input.notes).slice(0, 300) : null,
    created_by: actor,
  });
  return one("SELECT * FROM client_posting_plans WHERE id=?", [id]);
}

/** Extends the current plan by N months (keeps start & usage, adds posts pro-rata). */
export async function extendPlan(clientId, months, actor = "system") {
  const plan = await getPlan(clientId);
  if (!plan) throw new PlanLimitError("No posting plan to extend.", "NO_POSTING_PLAN");
  const add = Math.min(Math.max(parseInt(months, 10) || 1, 1), 24);
  const baseEnd = plan.end_date < today() ? addDays(today(), -1) : plan.end_date;
  const newEnd = endDateFor(addDays(baseEnd, 1), add);
  await update("client_posting_plans", plan.id, {
    end_date: newEnd,
    duration_months: plan.duration_months + add,
    total_posts: plan.total_posts + approxTotal(add, plan.posts_per_week),
    status: "ACTIVE",
    notes: `Extended +${add}m by ${actor}`.slice(0, 300),
  });
  return getPlan(clientId);
}

function planState(plan, on = today()) {
  if (!plan) return "NO_PLAN";
  if (on > String(plan.end_date).slice(0, 10)) return "EXPIRED";
  if (on < String(plan.start_date).slice(0, 10)) return "NOT_STARTED";
  return "ACTIVE";
}

async function countedItems(clientId, plan, excludeCalendarIds = []) {
  const ex = excludeCalendarIds.filter(Boolean).map(Number);
  const rows = await query(
    `SELECT DATE_FORMAT(DATE(COALESCE(t.scheduled_date, t.created_at)),'%Y-%m-%d') d, t.status s
       FROM ai_tasks t
      WHERE t.client_id=? AND t.status NOT IN ('REJECTED','FAILED')
        AND DATE(COALESCE(t.scheduled_date, t.created_at)) BETWEEN ? AND ?
     UNION ALL
     SELECT DATE_FORMAT(c.scheduled_date,'%Y-%m-%d') d, 'CAL_SCHEDULED' s
       FROM content_calendar c
      WHERE c.client_id=? AND c.status='SCHEDULED' AND c.scheduled_date BETWEEN ? AND ?
        AND NOT EXISTS (SELECT 1 FROM ai_tasks x WHERE x.calendar_id=c.id)
        ${ex.length ? `AND c.id NOT IN (${ex.map(() => "?").join(",")})` : ""}`,
    [clientId, plan.start_date, plan.end_date, clientId, plan.start_date, plan.end_date, ...ex],
  );
  return rows;
}

const weekIndex = (plan, d) => Math.floor(dayDiff(String(plan.start_date).slice(0, 10), d) / 7);

/** Everything the UI counters need. */
export async function planUsage(clientId, { excludeCalendarIds = [] } = {}) {
  const plan = await getPlan(clientId);
  const state = planState(plan);
  if (!plan) return { plan: null, state, required: Number((await getSettings()).posting_plan_required) === 1 };
  const items = await countedItems(clientId, plan, excludeCalendarIds);
  const counts = { published: 0, scheduled: 0, pending: 0, processing: 0 };
  const perWeek = new Map();
  for (const it of items) {
    if (PUBLISHED.includes(it.s)) counts.published++;
    else if (it.s === "CAL_SCHEDULED") counts.scheduled++;
    else if (PENDING.includes(it.s)) counts.pending++;
    else counts.processing++;
    const w = weekIndex(plan, it.d);
    perWeek.set(w, (perWeek.get(w) || 0) + 1);
  }
  const used = items.length;
  const refDay = state === "ACTIVE" ? today() : state === "NOT_STARTED" ? String(plan.start_date).slice(0, 10) : String(plan.end_date).slice(0, 10);
  const wi = weekIndex(plan, refDay);
  const wStart = addDays(String(plan.start_date).slice(0, 10), wi * 7);
  const weekUsed = perWeek.get(wi) || 0;
  return {
    plan: { ...plan, start_date: String(plan.start_date).slice(0, 10), end_date: String(plan.end_date).slice(0, 10), posting_days: plan.posting_days ? JSON.parse(plan.posting_days) : [] },
    state,
    total: plan.total_posts,
    used,
    remaining: Math.max(0, plan.total_posts - used),
    counts,
    week: { index: wi + 1, start: wStart, end: addDays(wStart, 6), limit: plan.posts_per_week, used: weekUsed, remaining: Math.max(0, plan.posts_per_week - weekUsed) },
    weeks: Object.fromEntries([...perWeek.entries()].map(([k, v]) => [k + 1, v])),
    daysLeft: Math.max(0, dayDiff(today(), String(plan.end_date).slice(0, 10)) + 1),
  };
}

/**
 * Throws PlanLimitError unless ALL `dates` can be added.
 * Used by: manual generate, calendar (single + bulk), nightly scheduler, public API.
 */
export async function assertCanSchedule(clientId, dates, { excludeCalendarIds = [] } = {}) {
  const list = (Array.isArray(dates) ? dates : [dates]).map((d) => String(d || today()).slice(0, 10));
  const plan = await getPlan(clientId);
  if (!plan) {
    if (Number((await getSettings()).posting_plan_required) === 1) {
      throw new PlanLimitError("Set up a posting plan for this client before scheduling posts.", "NO_POSTING_PLAN");
    }
    return null;
  }
  const start = String(plan.start_date).slice(0, 10);
  const end = String(plan.end_date).slice(0, 10);
  if (today() > end) throw new PlanLimitError(`This client's posting plan expired on ${end}. Renew or extend it to schedule posts.`, "PLAN_EXPIRED", { end });
  const days = plan.posting_days ? JSON.parse(plan.posting_days) : [];
  for (const d of list) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new PlanLimitError(`Invalid date ${d}.`, "INVALID_DATE");
    if (d < start || d > end) throw new PlanLimitError(`${d} is outside the posting plan (${start} to ${end}).`, "OUTSIDE_PLAN", { start, end });
    if (days.length && !days.includes(toDate(d).getDay())) {
      throw new PlanLimitError(`${d} is not one of this client's posting days.`, "NOT_A_POSTING_DAY", { days });
    }
  }
  const items = await countedItems(clientId, plan, excludeCalendarIds);
  if (items.length + list.length > plan.total_posts) {
    const left = Math.max(0, plan.total_posts - items.length);
    throw new PlanLimitError(`Plan limit reached: ${plan.total_posts} posts in total, ${left} left.`, "TOTAL_LIMIT", { total: plan.total_posts, used: items.length, remaining: left });
  }
  const perWeek = new Map();
  for (const it of items) perWeek.set(weekIndex(plan, it.d), (perWeek.get(weekIndex(plan, it.d)) || 0) + 1);
  for (const d of list) {
    const w = weekIndex(plan, d);
    const n = (perWeek.get(w) || 0) + 1;
    if (n > plan.posts_per_week) {
      const ws = addDays(start, w * 7);
      throw new PlanLimitError(
        `Weekly limit reached: ${plan.posts_per_week} posts per week (week of ${ws} - ${addDays(ws, 6)}).`,
        "WEEKLY_LIMIT",
        { limit: plan.posts_per_week, weekStart: ws, weekEnd: addDays(ws, 6) },
      );
    }
    perWeek.set(w, n);
  }
  return plan;
}

/**
 * Cross-process mutex around check+insert so two parallel requests can't both
 * take the last slot. Uses a MySQL named lock on a dedicated connection.
 */
export async function withPlanLock(clientId, fn) {
  const conn = await pool.getConnection();
  const name = `posting_plan_${Number(clientId)}`;
  try {
    const [[r]] = await conn.query("SELECT GET_LOCK(?, 10) ok", [name]);
    if (!r?.ok) throw new PlanLimitError("Another post is being scheduled for this client. Try again.", "BUSY");
    return await fn();
  } finally {
    try { await conn.query("SELECT RELEASE_LOCK(?)", [name]); } catch { /* ignore */ }
    conn.release();
  }
}

/** Daily sweep: flag expired plans (used by the scheduler). */
export async function expirePlans() {
  const r = await query("UPDATE client_posting_plans SET status='EXPIRED' WHERE status='ACTIVE' AND end_date < CURDATE()");
  return r.affectedRows || 0;
}
