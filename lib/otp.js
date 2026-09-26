import "server-only";
import crypto from "node:crypto";
import { one, insert, update, query } from "./db.js";
import { queueEmail } from "./mail/queue.js";
import { otpEmail } from "./mail/templates.js";

const OTP_TTL_MIN = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const OTP_MAX_ATTEMPTS = 5;

function secret() {
  return process.env.SESSION_SECRET || "dev-insecure-secret";
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (data.exp && data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function generateCode() {
  // 6-digit numeric code, crypto-random (not Math.random)
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashCode(code, challenge) {
  return crypto.createHmac("sha256", secret()).update(`${challenge}:${code}`).digest("hex");
}

/**
 * Starts an OTP challenge for a user (login 2FA or password reset).
 * Generates a 6-digit code, stores only its hash, emails it through the
 * background queue (so the login/forgot-password request returns instantly),
 * and returns a short-lived signed "challenge token" the client holds onto
 * and posts back with the code - the raw code itself never leaves the server
 * except inside the email.
 */
export async function startOtpChallenge({ userId, email, name, purpose = "LOGIN", ip = null, appUrl = null }) {
  const challenge = crypto.randomBytes(16).toString("hex");
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60000);

  await insert("otp_codes", {
    user_id: userId,
    purpose,
    challenge,
    code_hash: hashCode(code, challenge),
    max_attempts: OTP_MAX_ATTEMPTS,
    expires_at: expiresAt,
    ip,
  });

  const tpl = otpEmail({ name, code, minutes: OTP_TTL_MIN, purpose });
  await queueEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, template: "otp" });

  const token = sign({ userId, challenge, purpose, exp: Date.now() + OTP_TTL_MIN * 60000 });
  return { token, expiresInMinutes: OTP_TTL_MIN };
}

/**
 * Verifies a code against an open challenge. Returns the userId on success.
 * Throws a user-facing message on failure (wrong code, expired, too many
 * attempts, already used).
 */
export async function verifyOtpChallenge(token, code) {
  const data = verify(token);
  if (!data) throw new Error("This verification link has expired. Please sign in again.");

  const row = await one("SELECT * FROM otp_codes WHERE challenge=? AND user_id=? ORDER BY id DESC LIMIT 1", [
    data.challenge,
    data.userId,
  ]);
  if (!row) throw new Error("Verification code not found. Please request a new one.");
  if (row.consumed_at) throw new Error("This code has already been used. Please request a new one.");
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("This code has expired. Please request a new one.");
  if (row.attempts >= row.max_attempts) throw new Error("Too many incorrect attempts. Please request a new code.");

  const ok = hashCode(String(code).trim(), row.challenge) === row.code_hash;
  if (!ok) {
    await query("UPDATE otp_codes SET attempts=attempts+1 WHERE id=?", [row.id]);
    const left = row.max_attempts - (row.attempts + 1);
    throw new Error(left > 0 ? `Incorrect code. ${left} attempt(s) left.` : "Incorrect code. Please request a new one.");
  }

  await update("otp_codes", row.id, { consumed_at: new Date() });
  return { userId: data.userId, purpose: data.purpose };
}

/** Re-sends a fresh code for an existing (still valid) challenge token, without leaking whether the account exists. */
export async function resendOtpChallenge(token) {
  const data = verify(token);
  if (!data) throw new Error("This verification session has expired. Please start again.");
  const user = await one("SELECT id,name,email FROM users WHERE id=? AND active=1", [data.userId]);
  if (!user) throw new Error("This verification session has expired. Please start again.");
  return startOtpChallenge({ userId: user.id, email: user.email, name: user.name, purpose: data.purpose });
}
