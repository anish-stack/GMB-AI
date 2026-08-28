import "server-only";
import crypto from "node:crypto";
import { one, update } from "../db.js";

/**
 * Google OAuth for Business Profile.
 *
 * IMPORTANT MODEL:
 *   - The OAuth application (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) is YOURS.
 *     One Google Cloud project for the whole agency.
 *   - The token belongs to the CLIENT. Whoever presses "Allow" on the consent
 *     screen is the account whose refresh token you receive, and that token is
 *     stored on that client's row. The client never logs into your panel.
 *
 * So: you send the client a connect link -> they sign in with their own Gmail ->
 * they approve -> from then on your server manages their profile with their token.
 */
const SCOPE = "https://www.googleapis.com/auth/business.manage";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";

function secret() {
  return process.env.SESSION_SECRET || "dev-insecure-secret";
}

function key() {
  return crypto.createHash("sha256").update(secret()).digest();
}

/** Refresh tokens are long-lived credentials - encrypt at rest. */
export function encryptToken(plain) {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptToken(stored) {
  if (!stored) return null;
  const [iv, tag, data] = String(stored).split(".");
  if (!iv || !tag || !data) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function isOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function redirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || `${appUrl()}/api/gmb/callback`;
}

/**
 * Signed, expiring invite token. The client is NOT logged into the panel, so the
 * link itself carries the proof - HMAC signed, valid for GOOGLE_INVITE_DAYS days.
 */
export function createInviteToken(clientId, days = Number(process.env.GOOGLE_INVITE_DAYS || 14)) {
  const body = Buffer.from(JSON.stringify({ c: Number(clientId), exp: Date.now() + days * 86400000 })).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyInviteToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data.c;
  } catch {
    return null;
  }
}

export function connectLink(clientId) {
  return `${appUrl()}/api/gmb/connect?t=${createInviteToken(clientId)}`;
}

/** Consent screen URL. prompt=consent + access_type=offline is what returns a refresh token. */
export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: `${SCOPE} email`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token exchange failed: ${data.error_description || data.error || res.status}`);
  if (!data.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. The account has already granted access - remove this app at myaccount.google.com/permissions and retry."
    );
  }
  return data;
}

export async function fetchGoogleEmail(accessToken) {
  try {
    const res = await fetch(USERINFO, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    return (await res.json())?.email || null;
  } catch {
    return null;
  }
}

/** Save the client's own credentials. */
export async function saveClientTokens(clientId, { refresh_token, scope }, email) {
  await update("clients", clientId, {
    google_refresh_token: encryptToken(refresh_token),
    google_email: email,
    google_scope: scope || SCOPE,
    google_connected_at: new Date(),
    gmb_connection_status: "GOOGLE_CONNECTED",
  });
}

export async function disconnectClient(clientId) {
  await update("clients", clientId, {
    google_refresh_token: null,
    google_email: null,
    google_account_id: null,
    google_location_name: null,
    google_connected_at: null,
    gmb_connection_status: "MOCK_CONNECTED",
  });
}

/**
 * Access token for one client, cached in memory until it expires.
 * Falls back to the agency-wide GOOGLE_REFRESH_TOKEN when the client has none,
 * which covers profiles where your agency account was added as Manager instead.
 */
const cache = new Map();

export async function getAccessTokenForClient(clientId) {
  const hit = cache.get(clientId);
  if (hit && hit.exp > Date.now() + 60000) return hit.token;

  const row = await one("SELECT google_refresh_token FROM clients WHERE id=?", [clientId]);
  const refresh = decryptToken(row?.google_refresh_token) || process.env.GOOGLE_REFRESH_TOKEN || "";
  if (!refresh) {
    throw new Error(`Client ${clientId} has not connected Google yet. Send them the connect link.`);
  }
  if (!isOAuthConfigured()) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing in .env");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google refresh failed (${data.error || res.status}). The client may have revoked access, or the OAuth app is still in Testing mode where refresh tokens expire after 7 days.`
    );
  }
  cache.set(clientId, { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 });
  return data.access_token;
}

export { SCOPE };
