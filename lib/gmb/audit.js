import { query, one } from "../db.js";
import { providerFor } from "./provider.js";

/**
 * Google Business Profile audit: ~20 checks across name, category, description,
 * contact, services, photos, reviews, posts, products, links and keywords.
 * Weighted score 0-100. Each check links to the place it's fixed in this panel.
 */
const settle = async (p, fb) => {
  try {
    return await p;
  } catch {
    return fb;
  }
};
const days = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);

export async function runAudit(clientId) {
  const c = await one("SELECT * FROM clients WHERE id=?", [clientId]);
  if (!c) throw Object.assign(new Error("Client not found"), { status: 404 });
  const provider = await providerFor(clientId);
  const [profile, media, services, social, reviews, posts, products, tracked] = await Promise.all([
    settle(provider.getProfile(clientId), {}),
    settle(provider.getMedia(clientId), []),
    settle(provider.getServiceItems ? provider.getServiceItems(clientId) : null, null),
    settle(provider.getSocialLinks ? provider.getSocialLinks(clientId) : null, null),
    one(
      `SELECT COUNT(*) n, ROUND(AVG(rating),1) avg, SUM(status='REPLIED') replied, MAX(review_created_at) last,
              SUM(status='UNREPLIED') unreplied FROM review_inbox WHERE client_id=?`, [clientId]).catch(() => ({})),
    one("SELECT COUNT(*) n30, MAX(COALESCE(published_at, created_at)) last FROM gmb_posts WHERE client_id=? AND status<>'DELETED' AND COALESCE(published_at, created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)", [clientId]).catch(() => ({})),
    one("SELECT COUNT(*) n FROM gmb_products WHERE client_id=?", [clientId]).catch(() => ({ n: 0 })),
    one("SELECT COUNT(*) n FROM keywords WHERE client_id=? AND tracked=1", [clientId]).catch(() => ({ n: 0 })),
  ]);
  const lastPost = (await one("SELECT MAX(COALESCE(published_at, created_at)) last FROM gmb_posts WHERE client_id=? AND status<>'DELETED'", [clientId]).catch(() => null))?.last;
  const photos = (Array.isArray(media) ? media : media?.items || []).filter((m) => m.mediaFormat !== "VIDEO");
  const cats = (profile.additional_categories || []).length;
  const name = profile.business_name || c.business_name || "";
  const desc = String(profile.description || c.description || "");
  const city = String(profile.city || c.city || "").toLowerCase();
  const svcItems = services?.items || [];
  const svcWithDesc = svcItems.filter((s) => String(s.description || "").length >= 30).length;
  const socialCount = (social?.items || []).filter((x) => x.value).length;
  const hoursSet = profile.opening_hours && (Array.isArray(profile.opening_hours.periods) ? profile.opening_hours.periods.length : Object.keys(profile.opening_hours).length) > 0;
  const nReviews = Number(reviews?.n || profile.review_count || 0);
  const avg = Number(reviews?.avg || profile.rating || 0);
  const responseRate = nReviews ? Math.round((Number(reviews?.replied || 0) / nReviews) * 100) : null;
  const catWords = String(profile.category || c.business_category || "").toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const stuffed = name.length > 50 || (city && name.toLowerCase().includes(city) && catWords.some((w) => name.toLowerCase().includes(w)) && name.split(/[-|,]/).length > 1);

  const C = [];
  const add = (section, id, weight, status, title, detail, fix = null) => C.push({ section, id, weight, status, title, detail, fix });
  const tab = (t) => `/gmb/${clientId}?tab=${t}`;

  // Name
  add("Business name", "name_length", 4, name.length <= 50 ? "ok" : "warn", "Name length", name.length <= 50 ? `${name.length} characters - good.` : `${name.length} characters. Use the real-world business name; long names look like keyword stuffing.`, `/gmb/${clientId}?edit=1`);
  add("Business name", "name_stuffing", 6, stuffed ? "fail" : "ok", "No keyword stuffing", stuffed ? "The name seems to contain city / service keywords. Google can suspend listings for this - keep only the real business name." : "Name looks like a real brand name.", `/gmb/${clientId}?edit=1`);
  // Category
  add("Category", "primary_cat", 8, profile.category || c.business_category ? "ok" : "fail", "Primary category", profile.category || c.business_category || "Not set - the most important ranking factor.", `/gmb/${clientId}?edit=1`);
  add("Category", "additional_cats", 5, cats >= 2 ? "ok" : cats === 1 ? "warn" : "fail", "Additional categories", `${cats} of 9 added. Add every category that truly matches what you sell.`, `/gmb/${clientId}?edit=1`);
  // Description
  add("Description", "desc_length", 6, desc.length >= 600 ? "ok" : desc.length >= 250 ? "warn" : "fail", "Description length", `${desc.length}/750 characters. Aim for 600-750 describing services, area and what makes you different.`, `/gmb/${clientId}?edit=1`);
  add("Description", "desc_city", 3, city && desc.toLowerCase().includes(city) ? "ok" : "warn", "Mentions your city", city && desc.toLowerCase().includes(city) ? `Mentions ${profile.city || c.city}.` : "Mention the city / area you serve naturally in the description.", `/gmb/${clientId}?edit=1`);
  // Contact
  add("Contact & hours", "phone", 5, profile.phone || c.phone ? "ok" : "fail", "Phone number", profile.phone || c.phone || "Missing - customers can't call you.", `/gmb/${clientId}?edit=1`);
  add("Contact & hours", "website", 5, profile.website || c.website ? "ok" : "fail", "Website", profile.website || c.website || "Missing - add a website (you can build one in the Website tab).", tab("website"));
  add("Contact & hours", "hours", 5, hoursSet ? "ok" : "fail", "Opening hours", hoursSet ? "Set." : "Missing - listings without hours rank lower and show 'hours unknown'.", `/gmb/${clientId}?edit=1`);
  // Services
  add("Services & products", "services", 5, svcItems.length >= 5 ? "ok" : svcItems.length ? "warn" : "fail", "Services listed", `${svcItems.length} service(s). List at least 5-10 real services.`, tab("services"));
  add("Services & products", "service_desc", 3, !svcItems.length ? "warn" : svcWithDesc / svcItems.length >= 0.7 ? "ok" : "warn", "Service descriptions", svcItems.length ? `${svcWithDesc}/${svcItems.length} have a description.` : "Add services first.", tab("services"));
  add("Services & products", "products", 2, Number(products?.n) ? "ok" : "warn", "Products", Number(products?.n) ? `${products.n} product(s) in the catalog.` : "No products - add your top offers with price and image.", tab("products"));
  // Photos
  add("Photos", "photo_count", 6, photos.length >= 15 ? "ok" : photos.length >= 5 ? "warn" : "fail", "Photo count", `${photos.length} photos. Profiles with 15+ real photos get more calls and direction requests.`, tab("photos"));
  add("Photos", "logo_cover", 3, photos.some((p) => ["PROFILE", "LOGO"].includes(String(p.category).toUpperCase())) && photos.some((p) => String(p.category).toUpperCase() === "COVER") ? "ok" : "warn", "Logo & cover photo", "Both a logo and a cover photo should be set.", tab("photos"));
  const newestPhoto = photos.map((p) => p.createTime || p.create_time || p.created_at).filter(Boolean).sort().pop();
  add("Photos", "photo_recent", 3, newestPhoto && days(newestPhoto) <= 30 ? "ok" : "warn", "Fresh photos", newestPhoto ? `Last photo ${days(newestPhoto)} day(s) ago. Add new photos every month.` : "No recent uploads detected.", tab("photos"));
  // Reviews
  add("Reviews", "rating", 6, avg >= 4.5 ? "ok" : avg >= 4 ? "warn" : nReviews ? "fail" : "warn", "Average rating", nReviews ? `${avg}★ from ${nReviews} review(s).` : "No reviews yet.", "/reviews");
  add("Reviews", "review_count", 5, nReviews >= 50 ? "ok" : nReviews >= 10 ? "warn" : "fail", "Number of reviews", `${nReviews}. Use the Review QR to get a steady flow of new reviews.`, tab("links"));
  add("Reviews", "response_rate", 6, responseRate === null ? "warn" : responseRate >= 90 ? "ok" : responseRate >= 50 ? "warn" : "fail", "Review responses", responseRate === null ? "No reviews to answer yet." : `${responseRate}% answered${Number(reviews?.unreplied) ? ` · ${reviews.unreplied} waiting` : ""}. Reply to every review (auto-reply can help).`, "/reviews");
  add("Reviews", "review_recent", 3, reviews?.last && days(reviews.last) <= 30 ? "ok" : "warn", "Recent reviews", reviews?.last ? `Last review ${days(reviews.last)} day(s) ago.` : "No review in the last 30 days.", tab("links"));
  // Posts
  add("Posts", "post_recent", 6, lastPost && days(lastPost) <= 7 ? "ok" : lastPost && days(lastPost) <= 14 ? "warn" : "fail", "Posted this week", lastPost ? `Last post ${days(lastPost)} day(s) ago. Post at least weekly.` : "Never posted.", tab("posts"));
  add("Posts", "post_volume", 4, Number(posts?.n30) >= 8 ? "ok" : Number(posts?.n30) >= 4 ? "warn" : "fail", "Posts in the last 30 days", `${Number(posts?.n30 || 0)} post(s). 2-3 per week keeps the profile active.`, "/gmb/calendar");
  // Links & keywords
  add("Links & keywords", "social", 2, socialCount >= 2 ? "ok" : "warn", "Social profiles linked", `${socialCount} social / chat link(s) on the profile.`, tab("links"));
  add("Links & keywords", "tracked", 2, Number(tracked?.n) >= 3 ? "ok" : "warn", "Tracked keywords", `${Number(tracked?.n || 0)} keyword(s) tracked for ranking.`, tab("keywords"));

  const max = C.reduce((a, x) => a + x.weight, 0);
  const got = C.reduce((a, x) => a + (x.status === "ok" ? x.weight : x.status === "warn" ? x.weight * 0.5 : 0), 0);
  const sections = [...new Set(C.map((x) => x.section))].map((s) => {
    const list = C.filter((x) => x.section === s);
    const m = list.reduce((a, x) => a + x.weight, 0);
    const g = list.reduce((a, x) => a + (x.status === "ok" ? x.weight : x.status === "warn" ? x.weight * 0.5 : 0), 0);
    return { name: s, score: Math.round((g / m) * 100), checks: list };
  });
  return {
    score: Math.round((got / max) * 100),
    summary: {
      name,
      address: profile.address || c.address,
      category: profile.category || c.business_category,
      rating: avg || null,
      reviews: nReviews,
      photos: photos.length,
      maps_url: profile.maps_url || c.maps_url,
      logo: c.logo_url,
      cover: photos.find((p) => String(p.category).toUpperCase() === "COVER")?.googleUrl || photos[0]?.googleUrl || null,
      mock: Boolean(provider.isMock),
    },
    sections,
    counts: { ok: C.filter((x) => x.status === "ok").length, warn: C.filter((x) => x.status === "warn").length, fail: C.filter((x) => x.status === "fail").length },
    ran_at: new Date().toISOString(),
  };
}
