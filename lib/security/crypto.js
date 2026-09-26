import crypto from "node:crypto";

/** AES-256-GCM for secrets at rest (integration credentials, FCM tokens). */
function key() {
  const raw = process.env.APP_ENCRYPTION_KEY || process.env.SESSION_SECRET || "dev-insecure-secret";
  return crypto.createHash("sha256").update(`enc:${raw}`).digest();
}

export function encrypt(plain) {
  if (plain === null || plain === undefined) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}

export function decrypt(blob) {
  if (!blob) return null;
  const [v, iv, tag, data] = String(blob).split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const sha256 = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");

/** Keyed hash (pepper) for API keys / share tokens - a DB leak alone can't be brute-forced offline. */
export const hmac = (v) =>
  crypto.createHmac("sha256", process.env.API_KEY_PEPPER || process.env.SESSION_SECRET || "dev-insecure-secret").update(String(v)).digest("hex");

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");

export function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** "sk_live_abcd…wxyz" style masking for UI. */
export function mask(v) {
  const s = String(v || "");
  if (!s) return "";
  if (s.length <= 8) return "••••";
  return `••••${s.slice(-4)}`;
}
