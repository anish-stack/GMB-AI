import crypto from "node:crypto";

/**
 * Minimal FCM HTTP v1 client - no firebase-admin dependency.
 * Service account JSON -> signed JWT -> OAuth access token -> messages:send.
 */
const g = globalThis;
g.__fcmToken ||= { token: null, exp: 0, email: null };

function b64url(v) {
  return Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
}

function parseSa(raw) {
  const sa = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!sa?.client_email || !sa?.private_key || !sa?.project_id) throw new Error("Invalid Firebase service account JSON");
  return sa;
}

export async function fcmAccessToken(rawSa, { force = false } = {}) {
  const sa = parseSa(rawSa);
  const c = g.__fcmToken;
  if (!force && c.token && c.email === sa.client_email && c.exp - 60 > Date.now() / 1000) return c.token;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`FCM auth failed: ${json.error_description || json.error || res.status}`);
  g.__fcmToken = { token: json.access_token, exp: now + Number(json.expires_in || 3600), email: sa.client_email };
  return json.access_token;
}

/**
 * Sends one message. Returns { ok, invalidToken } - invalidToken=true means the
 * device unsubscribed / token expired and the caller should delete it.
 */
export async function sendFcm(rawSa, token, { title, body, link, tag, data = {} }) {
  const sa = parseSa(rawSa);
  const access = await fcmAccessToken(sa);
  const strData = Object.fromEntries(Object.entries({ ...data, title, body, link: link || "/" }).map(([k, v]) => [k, String(v ?? "")]));
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        // data-only so the service worker / page decides how to show it (avoids duplicate popups)
        data: strData,
        webpush: { headers: { Urgency: "high", TTL: "86400" }, fcm_options: link ? { link } : undefined },
        android: { priority: "HIGH" },
        apns: { headers: { "apns-priority": "10" }, payload: { aps: { alert: { title, body }, sound: "default" } } },
        ...(tag ? {} : {}),
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (res.ok) return { ok: true };
  const err = await res.json().catch(() => ({}));
  const code = err?.error?.details?.find?.((d) => d.errorCode)?.errorCode || err?.error?.status;
  const invalidToken = res.status === 404 || code === "UNREGISTERED" || (res.status === 400 && code === "INVALID_ARGUMENT");
  return { ok: false, invalidToken, error: err?.error?.message || `HTTP ${res.status}` };
}
