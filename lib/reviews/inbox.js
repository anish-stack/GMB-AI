import { query, one, update } from "../db.js";
import { providerFor, googleProvider } from "../gmb/provider.js";
import { buildKnowledge } from "../repo/knowledge.js";
import { runReviewReplyAgent } from "../ai/agents/reviewReply.js";
import { getSettings } from "../saas/settings.js";

const RATING = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
export const stars = (r) => (typeof r === "number" ? r : RATING[String(r || "").toUpperCase()] || Number(r) || null);
const dt = (v) => (v ? new Date(v) : null);
const bad = (m, status = 400) => Object.assign(new Error(m), { status });

/**
 * Upserts reviews for one client. Returns the rows that were NEW (first time seen)
 * so callers can notify + auto-draft. Replies made on Google directly are picked up too.
 */
export async function upsertReviews(clientId, tenantId, items = [], source = "SYNC") {
  const fresh = [];
  for (const r of items) {
    if (!r?.id) continue;
    const exists = await one("SELECT id, status, reply_comment FROM review_inbox WHERE client_id=? AND review_id=?", [clientId, String(r.id)]);
    const replyText = r.reply?.comment || null;
    if (!exists) {
      const res = await query(
        `INSERT INTO review_inbox (tenant_id, client_id, review_id, author, rating, comment, review_created_at, review_updated_at, reply_comment, replied_at, status, source)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [tenantId, clientId, String(r.id).slice(0, 190), String(r.author || "Google user").slice(0, 160), stars(r.rating), r.comment || "",
          dt(r.created_at), dt(r.updated_at || r.created_at), replyText, replyText ? dt(r.reply.updated_at) || new Date() : null, replyText ? "REPLIED" : "UNREPLIED", source],
      );
      if (!replyText) fresh.push({ id: res.insertId, client_id: clientId, author: r.author, rating: stars(r.rating), comment: r.comment || "" });
    } else {
      const patch = { comment: r.comment || "", rating: stars(r.rating), review_updated_at: dt(r.updated_at) };
      if (replyText && exists.status !== "REPLIED") Object.assign(patch, { status: "REPLIED", reply_comment: replyText, replied_at: dt(r.reply.updated_at) || new Date() });
      if (!replyText && exists.status === "REPLIED") Object.assign(patch, { status: "UNREPLIED", reply_comment: null, replied_at: null });
      await update("review_inbox", exists.id, patch);
    }
  }
  return fresh;
}

/** Called for every newly seen unreplied review: optional AI draft + tenant notification. */
export async function onNewReviews(clientId, tenantId, fresh) {
  if (!fresh.length) return;
  const settings = await getSettings();
  if (Number(settings.review_auto_draft) === 1) {
    for (const r of fresh.slice(0, 10)) await draftReply(r.id, { tenantId, tone: r.rating && r.rating <= 2 ? "apologetic" : "professional" }).catch(() => {});
  }
  const c = await one("SELECT business_name FROM clients WHERE id=?", [clientId]);
  const low = fresh.filter((r) => r.rating && r.rating <= 2);
  const { sendNotification } = await import("../notifications/service.js");
  await sendNotification({
    tenantId,
    type: low.length ? "ALERT" : "INFO",
    title: fresh.length === 1
      ? `New ${fresh[0].rating || ""}★ review - ${c?.business_name}`
      : `${fresh.length} new reviews - ${c?.business_name}`,
    body: low.length ? `${low.length} low rating(s) need a reply. AI drafts are ready.` : fresh[0].comment ? String(fresh[0].comment).slice(0, 140) : "AI reply drafts are ready in the review inbox.",
    link: `/reviews?client=${clientId}&status=UNREPLIED`,
    push: true,
  });
}

/** Pulls reviews for many clients (batchGetReviews per Google account) and updates the inbox. */
export async function syncReviews({ tenantId = null, clientIds = null, source = "SYNC" } = {}) {
  const where = ["c.active=1"];
  const params = [];
  if (tenantId) { where.push("c.tenant_id=?"); params.push(tenantId); }
  if (clientIds?.length) { where.push(`c.id IN (${clientIds.map(() => "?").join(",")})`); params.push(...clientIds.map(Number)); }
  const clients = await query(
    `SELECT c.id, c.tenant_id, c.google_location_name, c.gmb_connection_status, p.provider, p.connection_status
       FROM clients c LEFT JOIN gmb_profiles p ON p.client_id=c.id WHERE ${where.join(" AND ")}`,
    params,
  );
  const google = googleProvider();
  const live = google
    ? clients.filter((c) => c.google_location_name && (c.gmb_connection_status === "GOOGLE_CONNECTED" || (c.provider === "google" && c.connection_status === "GOOGLE_CONNECTED")))
    : [];
  const liveIds = new Set(live.map((c) => c.id));
  const results = { clients: clients.length, fresh: 0, errors: 0 };

  const batch = live.length ? await google.batchGetReviews(live.map((c) => c.id)) : new Map();
  for (const c of clients) {
    try {
      let items;
      if (liveIds.has(c.id)) items = batch.get(c.id) || [];
      else items = (await (await providerFor(c.id)).getReviews(c.id)).items || [];
      const fresh = await upsertReviews(c.id, c.tenant_id, items, source);
      results.fresh += fresh.length;
      await onNewReviews(c.id, c.tenant_id, fresh);
    } catch {
      results.errors += 1;
    }
  }
  return results;
}

async function inboxRow(id, tenantId) {
  const r = await one(
    `SELECT i.*, c.business_name FROM review_inbox i JOIN clients c ON c.id=i.client_id WHERE i.id=? ${tenantId ? "AND i.tenant_id=?" : ""}`,
    tenantId ? [Number(id), tenantId] : [Number(id)],
  );
  if (!r) throw bad("Review not found", 404);
  return r;
}

export async function draftReply(id, { tenantId = null, tone = "professional" } = {}) {
  const r = await inboxRow(id, tenantId);
  const kb = await buildKnowledge(r.client_id).catch(() => null);
  const res = await runReviewReplyAgent(
    { business: kb?.business || r.business_name, category: kb?.category, city: kb?.city, services: kb?.services || [], prohibited: kb?.prohibited_claims || [], reviewer: r.author, rating: r.rating, comment: r.comment },
    tone,
    { clientId: r.client_id, taskId: null },
  );
  await update("review_inbox", r.id, { ai_draft: res.reply, ai_draft_tone: res.tone, ai_draft_at: new Date() });
  return { draft: res.reply, tone: res.tone };
}

export async function publishReply(id, { tenantId, text, actor }) {
  const r = await inboxRow(id, tenantId);
  const reply = String(text || "").trim();
  if (!reply) throw bad("Reply can't be empty.");
  if (reply.length > 4096) throw bad("Reply is too long (max 4096).");
  await (await providerFor(r.client_id)).replyToReview(r.client_id, r.review_id, reply);
  await update("review_inbox", r.id, { status: "REPLIED", reply_comment: reply, replied_at: new Date(), replied_by: actor || null });
  return inboxRow(id, tenantId);
}

export async function setIgnored(id, { tenantId, ignored }) {
  const r = await inboxRow(id, tenantId);
  if (r.status === "REPLIED") throw bad("Already replied.");
  await update("review_inbox", r.id, { status: ignored ? "IGNORED" : "UNREPLIED" });
  return inboxRow(id, tenantId);
}

export async function listInbox(tenantId, { status = "UNREPLIED", clientId = null, maxStars = null, q = null, limit = 30, offset = 0 } = {}) {
  const where = ["i.tenant_id=?"];
  const params = [tenantId];
  if (status && status !== "ALL") { where.push("i.status=?"); params.push(status); }
  if (clientId) { where.push("i.client_id=?"); params.push(Number(clientId)); }
  if (maxStars) { where.push("i.rating<=?"); params.push(Number(maxStars)); }
  if (q) { where.push("(i.comment LIKE ? OR i.author LIKE ? OR c.business_name LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = where.join(" AND ");
  const [items, [{ total }], stats] = await Promise.all([
    query(
      `SELECT i.id, i.client_id, c.business_name, i.author, i.rating, i.comment, i.review_created_at, i.status, i.reply_comment, i.replied_at,
              i.ai_draft, i.ai_draft_tone, i.ai_draft_at, i.source, i.replied_by
         FROM review_inbox i JOIN clients c ON c.id=i.client_id WHERE ${w}
        ORDER BY (i.status='UNREPLIED') DESC, COALESCE(i.rating,5) ASC, i.review_created_at DESC LIMIT ${Math.min(Number(limit) || 30, 100)} OFFSET ${Number(offset) || 0}`,
      params,
    ),
    query(`SELECT COUNT(*) total FROM review_inbox i JOIN clients c ON c.id=i.client_id WHERE ${w}`, params),
    one(
      `SELECT SUM(status='UNREPLIED') unreplied, SUM(status='UNREPLIED' AND rating<=2) urgent, SUM(status='REPLIED') replied, COUNT(*) total,
              ROUND(AVG(rating),2) avg_rating, SUM(first_seen_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) new_7d
         FROM review_inbox WHERE tenant_id=?`,
      [tenantId],
    ),
  ]);
  const s = Object.fromEntries(Object.entries(stats || {}).map(([k, v]) => [k, Number(v || 0)]));
  s.response_rate = s.total ? Math.round((s.replied / s.total) * 100) : 0;
  return { items, total: Number(total), stats: s };
}
