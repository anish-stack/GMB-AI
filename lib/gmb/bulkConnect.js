import crypto from "node:crypto";
import { query, one, update } from "../db.js";
import { encryptToken, decryptToken } from "./googleAuth.js";
import { createClient } from "../repo/clients.js";
import { savePlan } from "../posting/plan.js";
import { linkGoogleLocation } from "../repo/gmb.js";

/**
 * "Connect ALL my Google Business Profiles" (agency / bulk mode).
 *
 * One Google sign-in is stored as a tenant-level connection. Its locations are
 * listed, and every location the tenant selects becomes its OWN client with its
 * own GMB link - no manual "sync / change location" per client.
 *
 * Google OAuth always grants access to every listing the signed-in Google user
 * manages; "single listing" mode (client connect link) links only the listing the
 * client picks, bulk mode lets the agency pick many.
 */
const ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const READ_MASK = "name,title,storefrontAddress,phoneNumbers,websiteUri,categories,metadata";
const secret = () => process.env.SESSION_SECRET || "dev-insecure-secret";
const bad = (m, status = 400) => Object.assign(new Error(m), { status });

/* ---------- signed OAuth state ---------- */
export function createState(payload, minutes = 30) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + minutes * 60000 })).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(`gstate:${body}`).digest("base64url");
  return `g2.${body}.${mac}`;
}

export function readState(token) {
  const [v, body, mac] = String(token || "").split(".");
  if (v !== "g2" || !body || !mac) return null;
  const expected = crypto.createHmac("sha256", secret()).update(`gstate:${body}`).digest("base64url");
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString());
    return d.exp > Date.now() ? d : null;
  } catch {
    return null;
  }
}

/* ---------- connection store ---------- */
export async function saveConnection(tenantId, { refresh_token, scope }, email, actor) {
  await query(
    `INSERT INTO google_connections (tenant_id, google_email, refresh_token_enc, scope, created_by)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE refresh_token_enc=VALUES(refresh_token_enc), scope=VALUES(scope), created_by=VALUES(created_by)`,
    [tenantId, email || `unknown-${Date.now()}`, encryptToken(refresh_token), scope || null, actor || null],
  );
  const row = await one("SELECT id FROM google_connections WHERE tenant_id=? AND google_email=?", [tenantId, email || ""]);
  return row?.id || (await one("SELECT MAX(id) id FROM google_connections WHERE tenant_id=?", [tenantId])).id;
}

export async function listConnections(tenantId) {
  return query(
    `SELECT g.id, g.google_email, g.created_by, g.created_at, g.last_scanned_at,
            (SELECT COUNT(*) FROM clients c WHERE c.google_connection_id=g.id) clients
       FROM google_connections g WHERE g.tenant_id=? ORDER BY g.id DESC`,
    [tenantId],
  );
}

async function getConnection(id, tenantId) {
  const c = await one("SELECT * FROM google_connections WHERE id=? AND tenant_id=?", [Number(id), tenantId]);
  if (!c) throw bad("Google connection not found", 404);
  return c;
}

async function accessToken(conn) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: decryptToken(conn.refresh_token_enc),
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw bad(`Google access expired for ${conn.google_email} - connect again. (${j.error || res.status})`, 401);
  return j.access_token;
}

async function gget(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw bad(`Google API ${res.status}: ${j?.error?.message || ""}`.slice(0, 300), res.status === 429 ? 429 : 502);
  return j;
}

/** Every location on every account this Google login manages. */
export async function connectionLocations(connectionId, tenantId) {
  const conn = await getConnection(connectionId, tenantId);
  const token = await accessToken(conn);
  const accounts = [];
  let pt = "";
  do {
    const j = await gget(`${ACCOUNTS}/accounts?pageSize=20${pt ? `&pageToken=${pt}` : ""}`, token);
    accounts.push(...(j.accounts || []));
    pt = j.nextPageToken || "";
  } while (pt && accounts.length < 200);

  const out = [];
  for (const a of accounts) {
    let lpt = "";
    do {
      const j = await gget(`${INFO}/${a.name}/locations?readMask=${READ_MASK}&pageSize=100${lpt ? `&pageToken=${lpt}` : ""}`, token);
      for (const l of j.locations || []) {
        const addr = l.storefrontAddress || {};
        out.push({
          account: a.name,
          account_name: a.accountName || a.name,
          name: l.name,
          title: l.title || "Untitled location",
          category: l.categories?.primaryCategory?.displayName || null,
          address: [...(addr.addressLines || []), addr.locality, addr.administrativeArea, addr.postalCode].filter(Boolean).join(", "),
          city: addr.locality || null,
          state: addr.administrativeArea || null,
          phone: l.phoneNumbers?.primaryPhone || null,
          website: l.websiteUri || null,
          verified: l.metadata?.hasVoiceOfMerchant !== false,
          location: l,
        });
      }
      lpt = j.nextPageToken || "";
    } while (lpt && out.length < 2000);
  }
  // mark the ones already imported for this tenant
  const existing = await query("SELECT id, google_location_name FROM clients WHERE tenant_id=? AND google_location_name IS NOT NULL", [tenantId]);
  const byName = new Map(existing.map((c) => [c.google_location_name, c.id]));
  await update("google_connections", conn.id, { last_scanned_at: new Date() });
  return { connection: { id: conn.id, email: conn.google_email }, items: out.map(({ location, ...x }) => ({ ...x, client_id: byName.get(x.name) || null })), _raw: out };
}

/**
 * Creates one client per picked location (skips ones already imported),
 * copies the connection's Google credentials, links the location and
 * applies the default posting plan. Returns created client ids.
 */
export async function importLocations({ tenantId, connectionId, picks = [], plan, actor }) {
  if (!Array.isArray(picks) || !picks.length) throw bad("Select at least one location.");
  if (!plan?.start_date || !plan?.duration_months || !plan?.posts_per_week) throw bad("Posting plan defaults are required.");
  const conn = await getConnection(connectionId, tenantId);
  const { _raw } = await connectionLocations(connectionId, tenantId);
  const byName = new Map(_raw.map((l) => [l.name, l]));
  const created = [];
  const skipped = [];
  for (const p of picks.slice(0, 500)) {
    const loc = byName.get(p.name || p);
    if (!loc) {
      skipped.push({ name: p.name || p, reason: "not found on this Google account" });
      continue;
    }
    const exists = await one("SELECT id FROM clients WHERE tenant_id=? AND google_location_name=?", [tenantId, loc.name]);
    if (exists) {
      skipped.push({ name: loc.title, reason: "already imported", client_id: exists.id });
      continue;
    }
    const clientId = await createClient(
      {
        business_name: loc.title,
        business_category: loc.category || "Pending Google sync",
        phone: loc.phone || "",
        website: loc.website || "",
        address: loc.address || "",
        city: loc.city || "",
        state: loc.state || "",
        posting_frequency: "THRICE_WEEKLY",
      },
      tenantId,
    );
    await savePlan(clientId, tenantId, plan, actor);
    await update("clients", clientId, {
      google_refresh_token: conn.refresh_token_enc,
      google_email: conn.google_email,
      google_scope: conn.scope,
      google_connected_at: new Date(),
      google_connection_id: conn.id,
      gmb_connection_status: "GOOGLE_CONNECTED",
    });
    await linkGoogleLocation(clientId, loc.account, loc.location);
    created.push({ client_id: clientId, title: loc.title });
  }
  return { created, skipped };
}

export async function deleteConnection(id, tenantId) {
  const conn = await getConnection(id, tenantId);
  await query("DELETE FROM google_connections WHERE id=?", [conn.id]);
  return { ok: true };
}


/**
 * Client connect link + "All my listings": the client's own record keeps one
 * listing, every OTHER listing on the same Google login becomes a new client in
 * the same agency (same Google credentials, same posting-plan rhythm).
 * Listings already imported in this agency are skipped.
 */
export async function importSiblingListings(sourceClientId, locations) {
  const src = await one("SELECT * FROM clients WHERE id=?", [sourceClientId]);
  if (!src) throw bad("Client not found", 404);
  const plan = await one("SELECT duration_months, posts_per_week, posting_days FROM client_posting_plans WHERE client_id=? AND status<>'REPLACED' ORDER BY id DESC LIMIT 1", [sourceClientId]);
  const { resolveEntitlements } = await import("../saas/entitlements.js");
  const { isUnlimited } = await import("../saas/constants.js");
  const ent = await resolveEntitlements(src.tenant_id);
  const [{ n }] = await query("SELECT COUNT(*) n FROM clients WHERE tenant_id=? AND active=1", [src.tenant_id]);
  const max = ent?.limits?.max_clients;
  let room = isUnlimited(max) ? Infinity : Math.max(0, Number(max) - Number(n));

  const created = [];
  const skipped = [];
  for (const l of locations) {
    const loc = l.location;
    const exists = await one("SELECT id FROM clients WHERE tenant_id=? AND google_location_name=?", [src.tenant_id, loc.name]);
    if (exists) { skipped.push({ title: loc.title, reason: "already a client" }); continue; }
    if (room <= 0) { skipped.push({ title: loc.title, reason: "client limit of your plan reached" }); continue; }
    const addr = loc.storefrontAddress || {};
    const clientId = await createClient(
      {
        business_name: loc.title || "Google listing",
        business_category: loc.categories?.primaryCategory?.displayName || "Pending Google sync",
        phone: loc.phoneNumbers?.primaryPhone || "",
        website: loc.websiteUri || "",
        address: [...(addr.addressLines || []), addr.locality, addr.administrativeArea, addr.postalCode].filter(Boolean).join(", "),
        city: addr.locality || "",
        state: addr.administrativeArea || "",
        posting_frequency: src.posting_frequency || "THRICE_WEEKLY",
      },
      src.tenant_id,
    );
    const today = new Date().toLocaleDateString("en-CA", { timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" });
    await savePlan(clientId, src.tenant_id, { start_date: today, duration_months: plan?.duration_months || 2, posts_per_week: plan?.posts_per_week || 3, posting_days: plan?.posting_days || null }, "connect-link");
    await update("clients", clientId, {
      google_refresh_token: src.google_refresh_token,
      google_email: src.google_email,
      google_scope: src.google_scope,
      google_connected_at: new Date(),
      gmb_connection_status: "GOOGLE_CONNECTED",
    });
    await linkGoogleLocation(clientId, l.account, loc);
    created.push({ client_id: clientId, title: loc.title });
    room--;
  }
  return { created, skipped };
}
