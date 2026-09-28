import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { one, update } from "./db.js";

/**
 * "Continue with Google" - OpenID Connect sign-in / sign-up.
 * Uses the same Google OAuth client as the GMB connection
 * (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET or Admin -> Integrations -> Google),
 * with its own redirect URI: {APP_URL}/api/auth/google/callback
 * (add it under "Authorized redirect URIs" in Google Cloud Console).
 */
const secret = () => process.env.SESSION_SECRET || "dev-insecure-secret";
const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const LOGIN_REDIRECT = () => process.env.GOOGLE_LOGIN_REDIRECT_URI || `${appUrl()}/api/auth/google/callback`;
export const NONCE_COOKIE = "g_login_nonce";

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(`glogin:${body}`).digest("base64url");
  return `${body}.${mac}`;
}

export function unsign(token) {
  const [body, mac] = String(token || "").split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", secret()).update(`glogin:${body}`).digest("base64url");
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    return data.exp && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Authorization URL + a nonce the caller stores in an httpOnly cookie (CSRF binding). */
export function authUrl({ next = null } = {}) {
  const nonce = crypto.randomBytes(16).toString("base64url");
  const state = sign({ n: nonce, next: next && String(next).startsWith("/") ? String(next).slice(0, 200) : null, exp: Date.now() + 10 * 60 * 1000 });
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: LOGIN_REDIRECT(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${p}`, nonce };
}

/** Exchanges the code and verifies the ID token with Google. Returns { sub, email, name, picture }. */
export async function verifyCallback(code) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: LOGIN_REDIRECT(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10000),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.id_token) throw new Error(tok.error_description || tok.error || "Google sign-in failed");
  const info = await (await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tok.id_token)}`, { signal: AbortSignal.timeout(10000) })).json();
  if (info.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error("Google token was issued for another app");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(info.iss)) throw new Error("Invalid Google token issuer");
  if (String(info.email_verified) !== "true") throw new Error("Your Google email is not verified");
  if (Number(info.exp) * 1000 < Date.now()) throw new Error("Google token expired");
  return { sub: info.sub, email: String(info.email).toLowerCase(), name: info.name || info.given_name || info.email.split("@")[0], picture: info.picture || null };
}

/**
 * Existing account -> { userId, redirect }.
 * No account -> { signupToken } (short-lived, carries the verified Google identity to /signup).
 */
export async function resolveGoogleUser(profile) {
  let user = await one("SELECT * FROM users WHERE google_sub=? LIMIT 1", [profile.sub]).catch(() => null);
  if (!user) user = await one("SELECT * FROM users WHERE email=? LIMIT 1", [profile.email]);
  if (user) {
    if (!user.active) throw new Error("This user is disabled. Contact your workspace owner.");
    if (user.tenant_id) {
      const t = await one("SELECT status FROM tenants WHERE id=?", [user.tenant_id]);
      if (!t || t.status === "CANCELLED") throw new Error("This account has been closed. Contact support.");
    }
    if (!user.google_sub) await update("users", user.id, { google_sub: profile.sub });
    return { userId: user.id, redirect: user.tenant_id ? "/dashboard" : "/admin" };
  }
  return { signupToken: sign({ g: 1, sub: profile.sub, email: profile.email, name: profile.name, exp: Date.now() + 30 * 60 * 1000 }) };
}

/** Verifies the token /signup received; returns the Google identity or null. */
export function readSignupToken(token) {
  const d = unsign(token);
  return d?.g === 1 && d.email ? { email: d.email, name: d.name, sub: d.sub } : null;
}

/** Random password for Google-only accounts (they can set one later via "Forgot password"). */
export async function randomPasswordHash() {
  return bcrypt.hash(crypto.randomBytes(24).toString("base64url"), 10);
}
