import { query, one } from "./db.js";
import { providerFor } from "./gmb/provider.js";
import { importFromGoogle } from "./gmb/importFromGoogle.js";

/**
 * Everything the website needs, taken from the client's Google Business Profile
 * (and what we already imported from it): name, logo, colors, photos, about text,
 * services with descriptions/prices, best reviews, address/phone/hours/map,
 * social links and SEO. Sent to the Website Builder's prefill endpoint.
 */
const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const SHORT = { MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun" };
const hhmm = (t) => (t ? `${String(t.hours || 0).padStart(2, "0")}:${String(t.minutes || 0).padStart(2, "0")}` : "");

/** Google regularHours (or our {MONDAY:{open,close}} shape) -> "Mon–Sat: 09:00–19:00 · Sun: Closed". */
export function hoursText(h) {
  if (!h) return "";
  const byDay = {};
  if (Array.isArray(h.periods)) {
    for (const p of h.periods) {
      const d = String(p.openDay || "").toUpperCase();
      const range = `${hhmm(p.openTime)}–${hhmm(p.closeTime) === "00:00" ? "24:00" : hhmm(p.closeTime)}`;
      byDay[d] = byDay[d] ? `${byDay[d]}, ${range}` : range;
    }
  } else if (typeof h === "object") {
    // simple text form used by demo / manual entry: { mon_sat: "10:00 - 19:00", sun: "Closed" }
    const textual = Object.entries(h).filter(([, v]) => typeof v === "string");
    if (textual.length) {
      const nice = (k) => k.split(/[_-]/).map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join("–");
      return textual.map(([k, v]) => `${nice(k)}: ${v.replace(/\s*-\s*/, "–")}`).join(" · ");
    }
    for (const [k, v] of Object.entries(h)) {
      const d = k.toUpperCase();
      if (!DAYS.includes(d)) continue;
      if (v && (v.open || v.close) && !v.closed) byDay[d] = `${v.open}–${v.close}`;
    }
  }
  if (!Object.keys(byDay).length) return "";
  const groups = [];
  for (const d of DAYS) {
    const v = byDay[d] || "Closed";
    const last = groups[groups.length - 1];
    if (last && last.v === v) last.to = d;
    else groups.push({ from: d, to: d, v });
  }
  return groups.map((g) => `${SHORT[g.from]}${g.to !== g.from ? `–${SHORT[g.to]}` : ""}: ${g.v}`).join(" · ");
}

const PHOTO_ORDER = ["COVER", "EXTERIOR", "INTERIOR", "AT_WORK", "TEAM", "PRODUCT", "ADDITIONAL"];
const photoRank = (c) => {
  const i = PHOTO_ORDER.indexOf(String(c || "").toUpperCase());
  return i === -1 ? 99 : i;
};
const money = (v) => (v === null || v === undefined ? "" : Number(v) === 0 ? "Free" : `₹${Number(v).toLocaleString("en-IN")}`);
const sentences = (t, n) => (String(t || "").match(/[^.!?]+[.!?]+/g) || [String(t || "")]).slice(0, n).join(" ").trim();

export async function buildPrefill(clientId) {
  let c = await one("SELECT * FROM clients WHERE id=?", [clientId]);
  if (!c) throw Object.assign(new Error("Client not found"), { status: 404 });
  const provider = await providerFor(clientId);

  // never imported yet? pull Google data first
  if (!provider.isMock && !c.google_imported_at) {
    await importFromGoogle(clientId).catch(() => null);
    c = await one("SELECT * FROM clients WHERE id=?", [clientId]);
  }

  const [profile, media, social, services, reviews, stats, keywords, locs] = await Promise.all([
    provider.getProfile(clientId).catch(() => null),
    provider.getMedia(clientId).catch(() => []),
    provider.getSocialLinks ? provider.getSocialLinks(clientId).catch(() => null) : null,
    query("SELECT name, description, price FROM gmb_services WHERE client_id=? ORDER BY id LIMIT 24", [clientId]),
    query(
      `SELECT author, rating, comment FROM review_inbox WHERE client_id=? AND rating>=4 AND CHAR_LENGTH(comment)>=25
        ORDER BY rating DESC, CHAR_LENGTH(comment) DESC, review_created_at DESC LIMIT 6`,
      [clientId],
    ).catch(() => []),
    one("SELECT ROUND(AVG(rating),1) avg, COUNT(*) n FROM review_inbox WHERE client_id=?", [clientId]).catch(() => null),
    query("SELECT keyword FROM keywords WHERE client_id=? ORDER BY relevance_score DESC LIMIT 12", [clientId]).catch(() => []),
    query("SELECT name FROM target_locations WHERE client_id=? LIMIT 6", [clientId]).catch(() => []),
  ]);

  const name = profile?.business_name || c.business_name;
  const category = profile?.category || c.business_category;
  const city = profile?.city || c.city || "";
  const description = profile?.description || c.description || "";
  const phone = profile?.phone || c.phone || "";
  const address = profile?.address || c.address || "";
  const photos = (Array.isArray(media) ? media : media?.items || [])
    .filter((m) => m.googleUrl && m.mediaFormat !== "VIDEO" && !["PROFILE", "LOGO"].includes(String(m.category).toUpperCase()))
    .sort((a, b) => photoRank(a.category) - photoRank(b.category))
    .slice(0, 6)
    .map((m) => m.googleUrl);
  const sl = Object.fromEntries((social?.items || []).filter((x) => x.value).map((x) => [x.id, x.value]));
  const rating = stats?.n ? `${stats.avg}★ on Google (${stats.n} reviews)` : null;
  const tagline = sentences(description, 1).slice(0, 120) || `${category}${city ? ` in ${city}` : ""}`;
  const tel = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";
  const mapsQuery = encodeURIComponent([name, address || city].filter(Boolean).join(", "));

  return {
    business: { name, category, city, phone, website: c.website || profile?.website || "" },
    basicInfo: { siteName: name, tagline, logo: c.logo_url || null, primaryColor: c.brand_color || null },
    hero: {
      title: name,
      subtitle: `${category}${city ? ` in ${city}` : ""}${rating ? ` · ${rating}` : ""}`,
      ctaText: phone ? "Call now" : "Contact us",
      ctaLink: tel || "#contact",
      images: photos.slice(0, 3),
    },
    about: {
      heading: `About ${name}`,
      shortText: sentences(description, 2).slice(0, 300),
      longText: description,
      image: photos[3] || photos[0] || null,
      highlights: [rating, ...services.slice(0, 3).map((s) => s.name), city ? `Serving ${[city, ...locs.map((l) => l.name).filter((l) => l !== city)].slice(0, 3).join(", ")}` : null].filter(Boolean).slice(0, 5),
    },
    services: services.map((s, i) => ({ title: s.name, description: s.description || "", price: money(s.price), displayOrder: i })),
    reviews: reviews.map((r, i) => ({ name: r.author || "Google user", rating: Number(r.rating) || 5, text: r.comment, designation: "Google review", displayOrder: i })),
    contact: {
      heading: "Get in touch",
      address,
      phone,
      email: "",
      workingHours: hoursText(profile?.opening_hours),
      // keyless embed by name + address (works for every listing, no Maps API key needed)
      mapEmbedUrl: `https://maps.google.com/maps?q=${mapsQuery}&output=embed`,
    },
    socialLinks: {
      facebook: sl.url_facebook || "", instagram: sl.url_instagram || "", twitter: sl.url_twitter || "",
      linkedin: sl.url_linkedin || "", youtube: sl.url_youtube || "", whatsapp: sl.url_whatsapp || "",
      website: c.website || "",
    },
    footer: { tagline, copyrightText: `© ${new Date().getFullYear()} ${name}. All rights reserved.` },
    seo: {
      title: `${name} | ${category}${city ? ` in ${city}` : ""}`.slice(0, 70),
      description: (sentences(description, 2) || `${name} - ${category}${city ? ` in ${city}` : ""}.${phone ? ` Call ${phone}.` : ""}`).slice(0, 160),
      keywords: keywords.map((k) => k.keyword),
      author: name,
      schemaType: "LocalBusiness",
      ogImage: photos[0] || c.logo_url || null,
    },
    links: { maps: c.maps_url || null, review: c.review_url || null },
  };
}

/** Suggested slug from the business name ("ABC Dental Clinic" -> "abc-dental-clinic"). */
export function suggestSlug(name) {
  return String(name || "site").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 40) || "site";
}
