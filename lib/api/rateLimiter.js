import { query } from "../db.js";

/**
 * Fixed-window counter in MySQL (one row per bucket per window).
 * Works across multiple app instances without Redis.
 * Returns { allowed, limit, remaining, resetAt }.
 */
export async function hit(bucket, { limit, windowSec = 60 }) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (now % windowSec);
  const windowStart = new Date(start * 1000);
  await query(
    `INSERT INTO api_rate_counters (bucket, window_start, hits) VALUES (?,?,1)
     ON DUPLICATE KEY UPDATE hits=hits+1`,
    [String(bucket).slice(0, 190), windowStart],
  );
  const [row] = await query("SELECT hits FROM api_rate_counters WHERE bucket=? AND window_start=?", [String(bucket).slice(0, 190), windowStart]);
  const hits = Number(row?.hits || 1);
  return { allowed: hits <= limit, limit, remaining: Math.max(0, limit - hits), resetAt: start + windowSec, hits };
}

/** Checks several buckets; the tightest failing one wins. */
export async function hitAll(rules) {
  let worst = null;
  for (const r of rules) {
    const res = await hit(r.bucket, r);
    const cur = { ...res, bucket: r.bucket, scope: r.scope };
    if (!res.allowed) return cur;
    if (!worst || cur.remaining < worst.remaining) worst = cur;
  }
  return worst || { allowed: true, limit: 0, remaining: 0, resetAt: 0 };
}

export function rateHeaders(r) {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(r.resetAt),
    ...(r.allowed ? {} : { "Retry-After": String(Math.max(1, r.resetAt - Math.floor(Date.now() / 1000))) }),
  };
}

/** Admin: clear counters for a tenant (tenant bucket + all its keys), a single key, or a user. */
export async function resetBuckets({ tenantId = null, apiKeyId = null, userId = null }) {
  const likes = [];
  if (apiKeyId) likes.push(`key:${Number(apiKeyId)}:%`);
  if (tenantId) {
    likes.push(`tenant:${Number(tenantId)}:%`);
    const keys = await query("SELECT id FROM api_keys WHERE tenant_id=?", [Number(tenantId)]);
    for (const k of keys) likes.push(`key:${k.id}:%`);
    const users = await query("SELECT id FROM users WHERE tenant_id=?", [Number(tenantId)]);
    for (const u of users) likes.push(`user:${u.id}:%`);
  }
  if (userId) likes.push(`user:${Number(userId)}:%`);
  let removed = 0;
  for (const l of likes) {
    const r = await query("DELETE FROM api_rate_counters WHERE bucket LIKE ?", [l]);
    removed += r.affectedRows || 0;
  }
  return removed;
}

/** Per-user limiter for heavy in-app actions (AI generation etc). Throws 429. */
export async function assertUserRate(userId, action, limit, windowSec = 60) {
  const r = await hit(`user:${Number(userId)}:${action}`, { limit, windowSec });
  if (!r.allowed) {
    throw Object.assign(new Error(`Too many requests. Try again in ${Math.max(1, r.resetAt - Math.floor(Date.now() / 1000))}s.`), { status: 429, code: "RATE_LIMITED" });
  }
}

/** Status for admin screens: current-minute usage per bucket prefix. */
export async function currentWindowUsage(prefix) {
  return query(
    `SELECT bucket, window_start, hits FROM api_rate_counters
      WHERE bucket LIKE ? AND window_start >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) ORDER BY window_start DESC`,
    [`${prefix}%`],
  );
}

export async function pruneCounters() {
  await query("DELETE FROM api_rate_counters WHERE window_start < DATE_SUB(NOW(), INTERVAL 1 DAY)");
}
