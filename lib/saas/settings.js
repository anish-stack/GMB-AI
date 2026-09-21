import { query, one } from "../db.js";
import { DEFAULT_PLATFORM_SETTINGS } from "./constants.js";

const cache = { data: null, at: 0 };
const TTL = 15 * 1000;

function parse(v) {
  if (v === null || v === undefined) return null;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

/** All platform settings merged over defaults. */
export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache.data && Date.now() - cache.at < TTL) return cache.data;
  let rows = [];
  try {
    rows = await query("SELECT skey, svalue FROM platform_settings");
  } catch {
    rows = [];
  }
  const data = { ...DEFAULT_PLATFORM_SETTINGS };
  for (const r of rows) data[r.skey] = parse(r.svalue);
  cache.data = data;
  cache.at = Date.now();
  return data;
}

export async function getSetting(key, fallback = null) {
  const s = await getSettings();
  return s[key] === undefined || s[key] === null ? fallback : s[key];
}

export async function setSettings(patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    const value = typeof v === "object" ? JSON.stringify(v) : String(v);
    await query(
      `INSERT INTO platform_settings (skey, svalue) VALUES (?,?)
       ON DUPLICATE KEY UPDATE svalue=VALUES(svalue)`,
      [k, value]
    );
  }
  cache.data = null;
  return getSettings({ fresh: true });
}

export async function creditCosts() {
  const s = await getSettings();
  return { ...DEFAULT_PLATFORM_SETTINGS.credit_costs, ...(s.credit_costs || {}) };
}

export async function publicBranding() {
  const s = await getSettings();
  return {
    platform_name: s.platform_name,
    support_email: s.support_email,
    currency: s.currency,
    allow_signup: Number(s.allow_signup) === 1,
  };
}

export async function nextInvoiceNo() {
  const s = await getSettings();
  const prefix = s.invoice_prefix || "INV";
  const row = await one("SELECT COUNT(*) AS n FROM invoices");
  const seq = Number(row?.n || 0) + 1;
  const now = new Date();
  return `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(seq).padStart(5, "0")}`;
}
