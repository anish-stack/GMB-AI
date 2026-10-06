import { query, one, insert } from "../db.js";
import { resolveEntitlements } from "../saas/entitlements.js";
import { isUnlimited } from "../saas/constants.js";

/**
 * Tracked keywords = the search terms a client ranks for (rank grid, reports).
 * Limited per client by the plan (max_keywords_client).
 * Suggestions: hyper-local phrases from the business's own services, category,
 * city, target areas and address landmarks + existing AI / Google keywords.
 */
const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}#\s-]/gu, " ").replace(/\s+/g, " ").trim();

export async function trackedLimit(tenantId) {
  const ent = await resolveEntitlements(tenantId);
  const v = ent?.limits?.max_keywords_client;
  return isUnlimited(v) ? 50 : Math.max(1, Number(v) || 5);
}

function landmarks(address, city) {
  // "Shop # 49, Habitat Arcade, Sector - 99A, Gurugram, Haryana" -> ["habitat arcade", "sector 99a", "99a"]
  const parts = String(address || "").split(",").map((p) => norm(p.replace(/sector\s*-\s*/i, "sector "))).filter(Boolean);
  const out = new Set();
  for (const p of parts) {
    if (!p || p === norm(city) || /^(india|haryana|delhi ncr|uttar pradesh|maharashtra)$/.test(p) || /^\d{6}$/.test(p)) continue;
    if (/^(shop|plot|flat|house|office|unit|floor|h no|no)\b/.test(p)) continue;
    if (p.length >= 3 && p.length <= 30) out.add(p);
    const m = p.match(/sector\s+(\w+)/);
    if (m) out.add(m[1]);
  }
  return [...out].slice(0, 4);
}

export async function suggestions(clientId) {
  const c = await one("SELECT business_category, city, address FROM clients WHERE id=?", [clientId]);
  const [svc, locs, kws] = await Promise.all([
    query("SELECT name FROM gmb_services WHERE client_id=? ORDER BY id LIMIT 8", [clientId]),
    query("SELECT name FROM target_locations WHERE client_id=? LIMIT 5", [clientId]),
    query("SELECT keyword, kw_type, source, relevance_score FROM keywords WHERE client_id=? AND tracked=0 ORDER BY relevance_score DESC LIMIT 30", [clientId]),
  ]);
  const cat = norm(c?.business_category);
  const city = norm(c?.city);
  const places = [...new Set([city, ...locs.map((l) => norm(l.name)), ...landmarks(c?.address, c?.city)].filter(Boolean))].slice(0, 6);
  const heads = [...new Set([cat, ...svc.map((s) => norm(s.name))].filter((x) => x && x !== "pending google sync"))].slice(0, 6);
  const out = new Map();
  const add = (k, why) => {
    const key = norm(k);
    if (key.length >= 4 && key.length <= 80 && !out.has(key)) out.set(key, why);
  };
  for (const k of kws) add(k.keyword, k.source === "GMB" ? "Real Google search term" : "AI keyword research");
  for (const h of heads) {
    for (const p of places) {
      add(`${h} in ${p}`, "High local intent");
      add(`best ${h} in ${p}`, "High local intent");
      add(`affordable ${h} in ${p}`, "High local intent");
    }
    add(`${h} near me`, "Near-me search");
    add(`best ${h} near me`, "Near-me search");
  }
  const tracked = new Set((await query("SELECT keyword FROM keywords WHERE client_id=? AND tracked=1", [clientId])).map((r) => norm(r.keyword)));
  return [...out.entries()].filter(([k]) => !tracked.has(k)).slice(0, 60).map(([keyword, reason]) => ({ keyword, reason }));
}

export async function listTracked(clientId) {
  return query("SELECT id, keyword, kw_type, source, created_at FROM keywords WHERE client_id=? AND tracked=1 ORDER BY id", [clientId]);
}

/** Adds (or marks as tracked) up to the remaining slots. */
export async function track(clientId, tenantId, list) {
  const limit = await trackedLimit(tenantId);
  const current = await listTracked(clientId);
  let room = limit - current.length;
  const have = new Set(current.map((r) => norm(r.keyword)));
  const added = [];
  const skipped = [];
  for (const raw of list) {
    const k = norm(raw);
    if (k.length < 3 || k.length > 120) { skipped.push({ keyword: raw, reason: "too short / long" }); continue; }
    if (have.has(k)) { skipped.push({ keyword: raw, reason: "already tracked" }); continue; }
    if (room <= 0) { skipped.push({ keyword: raw, reason: `limit of ${limit} reached` }); continue; }
    const ex = await one("SELECT id FROM keywords WHERE client_id=? AND LOWER(keyword)=?", [clientId, k]);
    if (ex) await query("UPDATE keywords SET tracked=1 WHERE id=?", [ex.id]);
    else await insert("keywords", { tenant_id: tenantId, client_id: clientId, keyword: k, kw_type: /near me|\bin\b/.test(k) ? "LOCATION" : "PRIMARY", source: "CLIENT", reason: "Tracked keyword", relevance_score: 90, priority: "HIGH", tracked: 1 });
    have.add(k);
    added.push(k);
    room--;
  }
  return { added, skipped, limit };
}

export async function untrack(clientId, id) {
  await query("UPDATE keywords SET tracked=0 WHERE id=? AND client_id=?", [Number(id), clientId]);
}
