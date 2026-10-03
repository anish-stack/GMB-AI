import { one, update } from "./db.js";
import { getIntegration } from "./integrations/store.js";

/**
 * Website Builder (separate Express/Mongo app) - server-to-server bridge.
 * Each tenant maps to one builder workspace; each GMB client to one builder client.
 * Tenants never log into the builder: we fetch a short-lived token and open the panel with ?sso_token=.
 */
const bad = (m, status = 400) => Object.assign(new Error(m), { status });

export async function wbConfig() {
  const i = await getIntegration("website_builder").catch(() => null);
  const v = i?.values || {};
  const api = String(v.api_base || process.env.WEBSITE_BUILDER_API || "").replace(/\/$/, "");
  const panel = String(v.panel_url || process.env.WEBSITE_BUILDER_PANEL || "").replace(/\/$/, "");
  const key = v.integration_key || process.env.WEBSITE_BUILDER_KEY || "";
  const enabled = i ? i.enabled !== false : true;
  return { api, panel, key, configured: Boolean(enabled && api && panel && key) };
}

async function wb(path, { method = "GET", body } = {}) {
  const cfg = await wbConfig();
  if (!cfg.configured) throw bad("Website builder is not configured (Admin -> Integrations -> Website Builder).", 503);
  const res = await fetch(`${cfg.api}/integration${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-integration-key": cfg.key },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false) throw bad(j.message || `Website builder error ${res.status}`, res.status >= 500 ? 502 : res.status);
  return j;
}

async function tenantName(tenantId) {
  return (await one("SELECT name FROM tenants WHERE id=?", [tenantId]))?.name || `Tenant ${tenantId}`;
}

/** Creates/updates the builder client for this GMB client; returns its id + websites. */
export async function syncBuilderClient(clientId, tenantId) {
  const c = await one("SELECT id, business_name, phone, google_email, website FROM clients WHERE id=? AND tenant_id=?", [clientId, tenantId]);
  if (!c) throw bad("Client not found", 404);
  const r = await wb("/clients/upsert", {
    method: "POST",
    body: { tenantId: String(tenantId), tenantName: await tenantName(tenantId), externalClientId: String(c.id), name: c.business_name, businessName: c.business_name, phone: c.phone || "", email: c.google_email || "", notes: c.website ? `Current website: ${c.website}` : "" },
  });
  if (r.client?.id) await update("clients", clientId, { website_builder_client_id: String(r.client.id) });
  return { builderClientId: r.client?.id, websites: r.websites || [] };
}

/** URL that opens the builder panel already signed in, at `next`. */
export async function ssoUrl(tenantId, next = "/") {
  const cfg = await wbConfig();
  const r = await wb("/sso", { method: "POST", body: { tenantId: String(tenantId), tenantName: await tenantName(tenantId) } });
  const path = String(next).startsWith("/") ? next : "/";
  const sep = path.includes("?") ? "&" : "?";
  return `${cfg.panel}${path}${sep}sso_token=${encodeURIComponent(r.token)}`;
}

export async function setLive(tenantId, websiteId, live) {
  return wb(`/websites/${encodeURIComponent(websiteId)}/publish`, { method: "PATCH", body: { tenantId: String(tenantId), live: Boolean(live) } });
}

export async function deleteSite(tenantId, websiteId) {
  return wb(`/websites/${encodeURIComponent(websiteId)}?tenantId=${encodeURIComponent(tenantId)}`, { method: "DELETE" });
}

/* ---------- websites built from GMB data ---------- */
export async function listThemes() {
  const cfg = await wbConfig();
  let origin = "";
  try {
    origin = new URL(cfg.api).origin;
  } catch {
    /* not configured */
  }
  // builder returns preview paths relative to its own host - make them absolute
  const abs = (u) => {
    if (!u) return null;
    if (/^https?:\/\//i.test(u) || u.startsWith("data:")) return u;
    return origin ? `${origin}${u.startsWith("/") ? "" : "/"}${u}` : null;
  };
  return ((await wb("/themes")).items || []).map((t) => ({ ...t, previewImage: abs(t.previewImage) }));
}

export async function checkSlug(slug) {
  return wb(`/slug?slug=${encodeURIComponent(slug)}`);
}

/** Creates the website for this client with the chosen theme and fills it with GMB data. */
export async function createFromGmb(clientId, tenantId, { themeId, slug, prefill }) {
  await syncBuilderClient(clientId, tenantId);
  const r = await wb("/websites", { method: "POST", body: { tenantId: String(tenantId), externalClientId: String(clientId), themeId, slug, prefill } });
  return r.site;
}

/** Re-applies GMB data: mode "fill" = only empty fields, "overwrite" = replace with Google's data. */
export async function refillFromGmb(tenantId, websiteId, prefill, mode = "fill") {
  const r = await wb(`/websites/${encodeURIComponent(websiteId)}/prefill`, { method: "PUT", body: { tenantId: String(tenantId), prefill, mode } });
  return r.site;
}

/** Writes only images (hero / about / per-service) into a website. */
export async function refillImages(tenantId, websiteId, images) {
  const r = await wb(`/websites/${encodeURIComponent(websiteId)}/prefill`, { method: "PUT", body: { tenantId: String(tenantId), mode: "images", images } });
  return r.site;
}
