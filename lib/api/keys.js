import crypto from "node:crypto";
import { query, one, insert, update } from "../db.js";
import { hmac } from "../security/crypto.js";

export const API_SCOPES = {
  "clients:read": "List clients and their posting plans",
  "posts:read": "Read posts and their status",
  "posts:write": "Create posts (counts against the posting plan)",
  "reviews:read": "Read Google reviews",
  "reports:read": "Read performance data",
};
export const ALL_SCOPES = Object.keys(API_SCOPES);
const PREFIX = "gmbk";

function cleanScopes(list) {
  const s = (Array.isArray(list) ? list : String(list || "").split(",")).map((x) => String(x).trim()).filter((x) => ALL_SCOPES.includes(x));
  return s.length ? [...new Set(s)] : ["clients:read", "posts:read"];
}

function newSecret() {
  const id = crypto.randomBytes(5).toString("hex"); // 10 chars public id
  const secret = crypto.randomBytes(24).toString("base64url");
  return { key: `${PREFIX}_${id}_${secret}`, prefix: `${PREFIX}_${id}` };
}

const view = (r) => ({
  id: r.id,
  name: r.name,
  prefix: r.key_prefix,
  scopes: String(r.scopes || "").split(",").filter(Boolean),
  active: Boolean(r.active) && !r.revoked,
  revoked: Boolean(r.revoked),
  expires_at: r.expires_at,
  expired: Boolean(r.expires_at && new Date(r.expires_at) < new Date()),
  last_used_at: r.last_used_at,
  last_used_ip: r.last_used_ip,
  request_count: Number(r.request_count || 0),
  rate_limit_per_min: r.rate_limit_per_min,
  created_at: r.created_at,
  revoked_at: r.revoked_at,
});

export async function listKeys(tenantId) {
  return (await query("SELECT * FROM api_keys WHERE tenant_id=? ORDER BY revoked, id DESC", [tenantId])).map(view);
}

/** Returns the plain key ONCE - only its keyed hash is stored. */
export async function createKey(tenantId, { name, scopes, expiresAt = null, userId = null }) {
  const count = await one("SELECT COUNT(*) n FROM api_keys WHERE tenant_id=? AND revoked=0", [tenantId]);
  if (Number(count.n) >= 20) throw Object.assign(new Error("Maximum of 20 active keys. Revoke unused keys first."), { status: 400 });
  const exp = expiresAt ? new Date(expiresAt) : null;
  if (exp && (Number.isNaN(exp.getTime()) || exp < new Date())) throw Object.assign(new Error("Expiry must be a future date."), { status: 400 });
  const { key, prefix } = newSecret();
  const id = await insert("api_keys", {
    tenant_id: tenantId,
    name: String(name || "API key").trim().slice(0, 120) || "API key",
    key_prefix: prefix,
    key_hash: hmac(key),
    scopes: cleanScopes(scopes).join(","),
    active: 1,
    expires_at: exp,
    created_by_user_id: userId,
    updated_at: new Date(),
  });
  return { key, item: view(await one("SELECT * FROM api_keys WHERE id=?", [id])) };
}

async function owned(tenantId, id) {
  const r = await one("SELECT * FROM api_keys WHERE id=? AND tenant_id=?", [Number(id), tenantId]);
  if (!r) throw Object.assign(new Error("API key not found"), { status: 404 });
  return r;
}

export async function updateKey(tenantId, id, { name, scopes, active, expiresAt }) {
  const r = await owned(tenantId, id);
  if (r.revoked) throw Object.assign(new Error("Revoked keys can't be changed."), { status: 400 });
  const patch = { updated_at: new Date() };
  if (name !== undefined) patch.name = String(name).trim().slice(0, 120) || r.name;
  if (scopes !== undefined) patch.scopes = cleanScopes(scopes).join(",");
  if (active !== undefined) patch.active = active ? 1 : 0;
  if (expiresAt !== undefined) patch.expires_at = expiresAt ? new Date(expiresAt) : null;
  await update("api_keys", r.id, patch);
  return view(await one("SELECT * FROM api_keys WHERE id=?", [r.id]));
}

export async function revokeKey(tenantId, id) {
  const r = await owned(tenantId, id);
  await update("api_keys", r.id, { revoked: 1, active: 0, revoked_at: new Date(), updated_at: new Date() });
}

/** New secret, same name/scopes/limits. The old value stops working immediately. */
export async function regenerateKey(tenantId, id) {
  const r = await owned(tenantId, id);
  if (r.revoked) throw Object.assign(new Error("Revoked keys can't be regenerated."), { status: 400 });
  const { key, prefix } = newSecret();
  await update("api_keys", r.id, { key_prefix: prefix, key_hash: hmac(key), updated_at: new Date(), last_used_at: null });
  return { key, item: view(await one("SELECT * FROM api_keys WHERE id=?", [r.id])) };
}

/** Resolves a presented key -> key row (+tenant) or throws 401. */
export async function authenticateKey(raw) {
  const key = String(raw || "").trim();
  if (!/^gmbk_[a-f0-9]{10}_[A-Za-z0-9_-]{20,}$/.test(key)) throw Object.assign(new Error("Missing or malformed API key."), { status: 401, code: "INVALID_API_KEY" });
  const row = await one(
    `SELECT k.*, t.status AS tenant_status FROM api_keys k JOIN tenants t ON t.id=k.tenant_id WHERE k.key_hash=? LIMIT 1`,
    [hmac(key)],
  );
  if (!row || row.revoked) throw Object.assign(new Error("Invalid API key."), { status: 401, code: "INVALID_API_KEY" });
  if (!row.active) throw Object.assign(new Error("This API key is disabled."), { status: 401, code: "KEY_DISABLED" });
  if (row.expires_at && new Date(row.expires_at) < new Date()) throw Object.assign(new Error("This API key has expired."), { status: 401, code: "KEY_EXPIRED" });
  if (row.tenant_status !== "ACTIVE") throw Object.assign(new Error("Workspace is not active."), { status: 403, code: "TENANT_INACTIVE" });
  return row;
}

export async function touchKey(id, ip) {
  await query("UPDATE api_keys SET last_used_at=NOW(), last_used_ip=?, request_count=request_count+1 WHERE id=?", [String(ip || "").slice(0, 64), id]);
}

export async function recordUsage({ tenantId, apiKeyId, endpoint, error = false, throttled = false }) {
  await query(
    `INSERT INTO api_usage_daily (tenant_id, api_key_id, day, endpoint, requests, errors, throttled) VALUES (?,?,CURDATE(),?,1,?,?)
     ON DUPLICATE KEY UPDATE requests=requests+1, errors=errors+VALUES(errors), throttled=throttled+VALUES(throttled)`,
    [tenantId, apiKeyId, String(endpoint).slice(0, 120), error ? 1 : 0, throttled ? 1 : 0],
  );
}

export async function usageSummary({ tenantId = null, days = 30 } = {}) {
  const where = tenantId ? "WHERE u.tenant_id=? AND u.day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)" : "WHERE u.day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";
  const params = tenantId ? [tenantId, days] : [days];
  const [byDay, byEndpoint, byTenant] = await Promise.all([
    query(`SELECT DATE_FORMAT(u.day,'%Y-%m-%d') day, SUM(requests) requests, SUM(errors) errors, SUM(throttled) throttled FROM api_usage_daily u ${where} GROUP BY u.day ORDER BY u.day`, params),
    query(`SELECT endpoint, SUM(requests) requests, SUM(errors) errors, SUM(throttled) throttled FROM api_usage_daily u ${where} GROUP BY endpoint ORDER BY requests DESC LIMIT 20`, params),
    tenantId
      ? Promise.resolve([])
      : query(`SELECT u.tenant_id, t.name tenant, SUM(requests) requests, SUM(errors) errors, SUM(throttled) throttled, MAX(u.day) last_day
                 FROM api_usage_daily u JOIN tenants t ON t.id=u.tenant_id ${where} GROUP BY u.tenant_id ORDER BY requests DESC LIMIT 100`, params),
  ]);
  return { byDay, byEndpoint, byTenant };
}
