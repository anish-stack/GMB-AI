import { query, one, insert } from "../db.js";
import { encrypt, decrypt, sha256 } from "../security/crypto.js";
import { getIntegration } from "../integrations/store.js";
import { sendFcm } from "../push/fcm.js";

export const NOTIFICATION_TYPES = ["INFO", "SUCCESS", "WARNING", "ALERT", "ANNOUNCEMENT", "MAINTENANCE", "BILLING", "TASK", "REPORT", "SUPPORT", "TENANT"];

/* ---------------- FCM token registry ---------------- */
export async function registerFcmToken({ userId, tenantId, token, platform, userAgent }) {
  const t = String(token || "").trim();
  if (t.length < 20 || t.length > 4096) throw Object.assign(new Error("Invalid token"), { status: 400 });
  await query(
    `INSERT INTO fcm_tokens (user_id, tenant_id, token_hash, token_enc, platform, user_agent, last_seen_at, failures)
     VALUES (?,?,?,?,?,?,NOW(),0)
     ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), tenant_id=VALUES(tenant_id), platform=VALUES(platform),
       user_agent=VALUES(user_agent), last_seen_at=NOW(), failures=0`,
    [userId, tenantId || null, sha256(t), encrypt(t), String(platform || "web").slice(0, 40), String(userAgent || "").slice(0, 250)],
  );
  // cap devices per user (oldest dropped)
  await query(
    `DELETE FROM fcm_tokens WHERE user_id=? AND id NOT IN (
       SELECT id FROM (SELECT id FROM fcm_tokens WHERE user_id=? ORDER BY last_seen_at DESC LIMIT 10) keep)`,
    [userId, userId],
  );
}

export async function removeFcmToken(userId, token) {
  await query("DELETE FROM fcm_tokens WHERE user_id=? AND token_hash=?", [userId, sha256(String(token || ""))]);
}

async function pushToUsers(userIds, payload) {
  const stats = { sent: 0, failed: 0, skipped: 0 };
  if (!userIds.length) return stats;
  const fb = await getIntegration("firebase");
  if (!fb?.enabled || !fb.values.service_account) {
    stats.skipped = userIds.length;
    return stats;
  }
  const tokens = await query(
    `SELECT id, user_id, token_enc FROM fcm_tokens WHERE user_id IN (${userIds.map(() => "?").join(",")})`,
    userIds,
  );
  for (const row of tokens) {
    const token = decrypt(row.token_enc);
    if (!token) {
      await query("DELETE FROM fcm_tokens WHERE id=?", [row.id]);
      continue;
    }
    try {
      const r = await sendFcm(fb.values.service_account, token, payload);
      if (r.ok) stats.sent++;
      else {
        stats.failed++;
        if (r.invalidToken) await query("DELETE FROM fcm_tokens WHERE id=?", [row.id]);
        else await query("UPDATE fcm_tokens SET failures=failures+1 WHERE id=?", [row.id]);
      }
    } catch {
      stats.failed++;
    }
  }
  await query("DELETE FROM fcm_tokens WHERE failures >= 5");
  return stats;
}

/**
 * One notification -> one row per recipient user (per-user read state) + optional FCM push.
 * target: { userIds } | { tenantId } (all active users of the tenant) | { tenantIds } | { all: true }
 */
export async function sendNotification({ userIds = null, tenantId = null, tenantIds = null, all = false, type = "INFO", title, body = null, link = null, push = true, broadcastId = null }) {
  let users = [];
  if (userIds?.length) {
    users = await query(`SELECT id, tenant_id FROM users WHERE active=1 AND id IN (${userIds.map(() => "?").join(",")})`, userIds.map(Number));
  } else if (tenantId || tenantIds?.length) {
    const ids = tenantIds?.length ? tenantIds.map(Number) : [Number(tenantId)];
    users = await query(`SELECT id, tenant_id FROM users WHERE active=1 AND tenant_id IN (${ids.map(() => "?").join(",")})`, ids);
  } else if (all) {
    users = await query("SELECT id, tenant_id FROM users WHERE active=1 AND tenant_id IS NOT NULL");
  }
  const cleanTitle = String(title || "").slice(0, 220);
  const cleanBody = body ? String(body).slice(0, 600) : null;
  const safeLink = link && String(link).startsWith("/") ? String(link).slice(0, 250) : null;

  for (const u of users) {
    await insert("notifications", {
      tenant_id: u.tenant_id,
      user_id: u.id,
      type: NOTIFICATION_TYPES.includes(type) ? type : "INFO",
      title: cleanTitle,
      body: cleanBody,
      link: safeLink,
      broadcast_id: broadcastId,
      push_status: push ? "PENDING" : null,
    });
  }
  let stats = { sent: 0, failed: 0, skipped: 0 };
  if (push && users.length) {
    stats = await pushToUsers(users.map((u) => u.id), { title: cleanTitle, body: cleanBody || "", link: safeLink || "/notifications", data: { type } });
    const ids = users.map((u) => u.id);
    await query(
      `UPDATE notifications SET push_status=? WHERE push_status='PENDING' AND user_id IN (${ids.map(() => "?").join(",")}) ${broadcastId ? "AND broadcast_id=?" : ""}`,
      [stats.sent ? "SENT" : stats.skipped ? "SKIPPED" : "FAILED", ...ids, ...(broadcastId ? [broadcastId] : [])],
    );
  }
  return { recipients: users.length, push: stats };
}

/* ---------------- user notification center ---------------- */
export async function listForUser(user, { limit = 20, before = null, unreadOnly = false } = {}) {
  const params = [user.id];
  let where = "user_id=?";
  if (unreadOnly) where += " AND is_read=0";
  if (before) {
    where += " AND id<?";
    params.push(Number(before));
  }
  const items = await query(
    `SELECT id, type, title, body, link, is_read, read_at, created_at FROM notifications WHERE ${where} ORDER BY id DESC LIMIT ${Math.min(Number(limit) || 20, 100)}`,
    params,
  );
  const [{ unread }] = await query("SELECT COUNT(*) unread FROM notifications WHERE user_id=? AND is_read=0", [user.id]);
  return { items, unread: Number(unread) };
}

export async function markRead(user, ids = null) {
  if (ids?.length) {
    const clean = ids.map(Number).filter(Boolean).slice(0, 200);
    if (!clean.length) return;
    await query(
      `UPDATE notifications SET is_read=1, read_at=NOW() WHERE user_id=? AND is_read=0 AND id IN (${clean.map(() => "?").join(",")})`,
      [user.id, ...clean],
    );
  } else {
    await query("UPDATE notifications SET is_read=1, read_at=NOW() WHERE user_id=? AND is_read=0", [user.id]);
  }
}

export async function latestIdForUser(userId) {
  const r = await one("SELECT MAX(id) id, SUM(is_read=0) unread FROM notifications WHERE user_id=?", [userId]);
  return { lastId: Number(r?.id || 0), unread: Number(r?.unread || 0) };
}
