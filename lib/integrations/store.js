import { one, query } from "../db.js";
import { encrypt, decrypt, mask } from "../security/crypto.js";
import { INTEGRATIONS, byId } from "./registry.js";
import { runIntegrationTest } from "./tests.js";

const g = globalThis;
g.__integrationCache ||= { at: 0, rows: null, baseEnv: null };
const TTL = 30 * 1000;

async function rows(fresh = false) {
  const c = g.__integrationCache;
  if (!fresh && c.rows && Date.now() - c.at < TTL) return c.rows;
  let list = [];
  if (process.env.NEXT_PHASE === "phase-production-build") return {};
  try {
    list = await query("SELECT * FROM integration_settings");
  } catch {
    list = []; // table missing before migration - fall back to .env only
  }
  c.rows = Object.fromEntries(list.map((r) => [r.provider, r]));
  c.at = Date.now();
  return c.rows;
}

function parse(row) {
  if (!row?.config_enc) return {};
  try {
    return JSON.parse(decrypt(row.config_enc) || "{}");
  } catch {
    return {};
  }
}

/** Server-only: effective config for one integration (DB values over .env). */
export async function getIntegration(id) {
  const def = byId(id);
  if (!def) return null;
  const row = (await rows())[id];
  const cfg = parse(row);
  const values = {};
  for (const f of def.fields) values[f.key] = cfg[f.key] || (f.env ? process.env[f.env] || "" : "");
  const configured = def.fields.filter((f) => !/optional/i.test(f.label)).some((f) => values[f.key]);
  return { id, enabled: row ? Boolean(row.enabled) : configured, configured, values, row };
}

/** Browser-safe view: public fields in clear, secrets only as mask/configured flags. */
export async function listIntegrationsForAdmin() {
  const all = await rows(true);
  const out = [];
  for (const def of INTEGRATIONS) {
    const eff = await getIntegration(def.id);
    const row = all[def.id];
    out.push({
      id: def.id,
      name: def.name,
      group: def.group,
      docs: def.docs || null,
      enabled: eff.enabled,
      configured: eff.configured,
      source: row?.config_enc ? "database" : eff.configured ? "env" : null,
      lastTest: row?.last_tested_at ? { status: row.last_test_status, message: row.last_test_message, at: row.last_tested_at } : null,
      fields: def.fields.map((f) => ({
        key: f.key,
        label: f.label,
        secret: Boolean(f.secret),
        multiline: Boolean(f.multiline),
        hint: f.hint || null,
        placeholder: f.placeholder || "",
        value: f.secret ? "" : eff.values[f.key] || "",
        masked: f.secret ? (f.multiline ? (eff.values[f.key] ? "•••• saved ••••" : "") : mask(eff.values[f.key])) : null,
        set: Boolean(eff.values[f.key]),
      })),
    });
  }
  return out;
}

/** patch: { field: value }. Empty string on a secret = keep existing; "__clear__" = remove. */
export async function saveIntegration(id, { enabled, values = {} }, actor) {
  const def = byId(id);
  if (!def) throw Object.assign(new Error("Unknown integration"), { status: 404 });
  const row = await one("SELECT * FROM integration_settings WHERE provider=?", [id]);
  const current = parse(row);
  for (const f of def.fields) {
    if (!(f.key in values)) continue;
    const v = typeof values[f.key] === "string" ? values[f.key].trim() : values[f.key];
    if (v === "__clear__") delete current[f.key];
    else if (f.secret && !v) continue;
    else current[f.key] = String(v ?? "").slice(0, 20000);
  }
  if (current.service_account) {
    try {
      const sa = JSON.parse(current.service_account);
      if (!sa.client_email || !sa.private_key) throw new Error();
    } catch {
      throw Object.assign(new Error("Service account must be the JSON file downloaded from Firebase."), { status: 400 });
    }
  }
  await query(
    `INSERT INTO integration_settings (provider, enabled, config_enc, updated_by) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), config_enc=VALUES(config_enc), updated_by=VALUES(updated_by)`,
    [id, enabled === undefined ? (row?.enabled ?? 1) : enabled ? 1 : 0, encrypt(JSON.stringify(current)), actor || "admin"],
  );
  await hydrateEnvFromIntegrations({ fresh: true });
  return { ok: true };
}

export async function testIntegration(id) {
  const eff = await getIntegration(id);
  if (!eff) throw Object.assign(new Error("Unknown integration"), { status: 404 });
  let status = "FAILED";
  let message = "";
  try {
    if (!eff.configured) throw new Error("Not configured");
    message = (await runIntegrationTest(id, eff.values)) || "Connection OK";
    status = "OK";
  } catch (err) {
    message = String(err.message || err).slice(0, 480);
  }
  await query(
    `INSERT INTO integration_settings (provider, enabled, last_test_status, last_test_message, last_tested_at) VALUES (?,?,?,?,NOW())
     ON DUPLICATE KEY UPDATE last_test_status=VALUES(last_test_status), last_test_message=VALUES(last_test_message), last_tested_at=NOW()`,
    [id, eff.enabled ? 1 : 0, status, message],
  );
  g.__integrationCache.at = 0;
  return { status, message };
}

/**
 * Pushes admin-managed credentials into process.env so existing code that
 * reads process.env (AI providers, SMTP, storage, Google OAuth) picks them up
 * without a restart. Original .env values are remembered, so disabling an
 * integration restores them.
 */
export async function hydrateEnvFromIntegrations({ fresh = false } = {}) {
  const c = g.__integrationCache;
  if (!c.baseEnv) c.baseEnv = { ...process.env };
  const all = await rows(fresh);
  for (const def of INTEGRATIONS) {
    const row = all[def.id];
    if (!row) continue;
    const cfg = parse(row);
    for (const f of def.fields) {
      if (!f.env) continue;
      if (row.enabled && cfg[f.key]) process.env[f.env] = cfg[f.key];
      else if (c.baseEnv[f.env] !== undefined) process.env[f.env] = c.baseEnv[f.env];
      else delete process.env[f.env];
    }
    for (const [k, v] of Object.entries(def.envWhenEnabled || {})) {
      if (row.enabled && Object.keys(cfg).length) process.env[k] = v;
      else if (c.baseEnv[k] !== undefined) process.env[k] = c.baseEnv[k];
    }
  }
  try {
    const { resetStorageChain } = await import("../storage/index.js");
    resetStorageChain();
  } catch {
    /* storage not loaded in this process */
  }
}

/** Browser-safe Firebase web config (null when push isn't set up). */
export async function publicFirebaseConfig() {
  const fb = await getIntegration("firebase");
  const v = fb?.values || {};
  if (!fb?.enabled || !v.api_key || !v.project_id || !v.messaging_sender_id || !v.app_id || !v.vapid_key) return null;
  return {
    apiKey: v.api_key,
    authDomain: v.auth_domain || `${v.project_id}.firebaseapp.com`,
    projectId: v.project_id,
    messagingSenderId: v.messaging_sender_id,
    appId: v.app_id,
    vapidKey: v.vapid_key,
  };
}

export async function publicAnalyticsId() {
  const ga = await getIntegration("analytics");
  return ga?.enabled ? ga.values.measurement_id || null : null;
}
