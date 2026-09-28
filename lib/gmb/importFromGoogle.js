import { query, one, update, insert } from "../db.js";
import { providerFor } from "./provider.js";

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Pulls everything Google already knows into our client record, so onboarding
 * never asks for services / locations / keywords again:
 *   profile basics, description, services (+description/price), city -> target
 *   location, logo, Maps + review links, place id, search keywords.
 * Safe to run repeatedly (called after every connect / sync).
 */
export async function importFromGoogle(clientId) {
  const provider = await providerFor(clientId);
  if (provider.isMock) return { skipped: "not connected to Google" };
  const client = await one("SELECT * FROM clients WHERE id=?", [clientId]);
  if (!client) return { skipped: "client not found" };
  const out = { services: 0, locations: 0, keywords: 0, logo: false };

  /* ---- profile basics ---- */
  const p = await provider.getProfile(clientId);
  const patch = {
    business_name: p.business_name || client.business_name,
    business_category: p.category || client.business_category,
    phone: p.phone || client.phone,
    website: p.website || client.website,
    address: p.address || client.address,
    city: p.city || client.city,
    state: p.state || client.state,
    description: p.description || client.description,
    place_id: p.place_id || client.place_id,
    latitude: p.latitude ?? client.latitude,
    longitude: p.longitude ?? client.longitude,
    maps_url: p.maps_url || client.maps_url,
    review_url: p.review_url || client.review_url,
    google_imported_at: new Date(),
  };
  await update("clients", clientId, patch);

  /* ---- services (Google is the source of truth) ---- */
  try {
    const s = await provider.getServiceItems(clientId);
    const catName = new Map(s.categories.map((c) => [c.id, c.name]));
    if (s.items.length) {
      await query("DELETE FROM gmb_services WHERE client_id=?", [clientId]);
      for (const it of s.items) {
        await insert("gmb_services", {
          client_id: clientId,
          name: String(it.name).slice(0, 160),
          description: it.description ? String(it.description).slice(0, 300) : null,
          category: catName.get(it.category) || null,
          price: it.price,
        });
      }
      out.services = s.items.length;
    }
  } catch {
    /* services not allowed for this category */
  }

  /* ---- target location ---- */
  const locs = await query("SELECT name FROM target_locations WHERE client_id=?", [clientId]);
  const have = new Set(locs.map((l) => norm(l.name)));
  for (const l of [patch.city, patch.state].filter(Boolean)) {
    if (!have.has(norm(l))) {
      await insert("target_locations", { client_id: clientId, name: l });
      have.add(norm(l));
      out.locations += 1;
    }
  }

  /* ---- logo (Google media PROFILE / LOGO photo) ---- */
  if (!client.logo_url) {
    try {
      const media = await provider.getMedia(clientId);
      const list = Array.isArray(media) ? media : media?.items || [];
      const logo = list.find((m) => ["PROFILE", "LOGO"].includes(String(m.category).toUpperCase()));
      if (logo?.googleUrl) {
        await update("clients", clientId, { logo_url: logo.googleUrl });
        out.logo = true;
      }
    } catch {
      /* no media */
    }
  }

  /* ---- keywords: real Google search terms + category/service x city ---- */
  const existing = new Set((await query("SELECT keyword FROM keywords WHERE client_id=?", [clientId])).map((k) => norm(k.keyword)));
  const add = async (keyword, kw_type, reason, score) => {
    const k = norm(keyword);
    if (!k || k.length < 3 || existing.has(k) || existing.size > 200) return;
    existing.add(k);
    await insert("keywords", { tenant_id: client.tenant_id, client_id: clientId, keyword: k.slice(0, 180), kw_type, source: "GMB", reason, relevance_score: score, priority: kw_type === "PRIMARY" ? "HIGH" : "MEDIUM" });
    out.keywords += 1;
  };
  try {
    const kw = await provider.getSearchKeywords(clientId, {});
    const terms = (kw?.keywords || []).slice(0, 15);
    for (let i = 0; i < terms.length; i++) {
      await add(terms[i].keyword, i < 3 ? "PRIMARY" : "SECONDARY", `Real Google search term (${terms[i].impressions} impressions)`, Math.max(40, 95 - i * 4));
    }
  } catch {
    /* keyword data needs ~1 month of history */
  }
  const city = patch.city;
  const cat = patch.business_category && patch.business_category !== "Pending Google sync" ? patch.business_category : null;
  if (cat) {
    if (city) await add(`${cat} in ${city}`, "PRIMARY", "Category + city", 85);
    await add(`${cat} near me`, "SECONDARY", "Near-me intent", 75);
  }
  const services = await query("SELECT name FROM gmb_services WHERE client_id=? ORDER BY id LIMIT 8", [clientId]);
  for (const s of services) {
    if (city) await add(`${s.name} in ${city}`, "TERTIARY", "Service + city", 70);
  }
  return out;
}
