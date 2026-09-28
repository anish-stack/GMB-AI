import { one } from "../db.js";

/**
 * Real public links for a listing. Prefers what Google returned
 * (metadata.newReviewUri / mapsUri), falls back to place-id links.
 */
export async function listingLinks(clientId) {
  const c = await one("SELECT business_name, city, website, place_id, maps_url, review_url FROM clients WHERE id=?", [clientId]);
  if (!c) return null;
  const pid = c.place_id && !String(c.place_id).startsWith("sample") ? c.place_id : null;
  const q = encodeURIComponent([c.business_name, c.city].filter(Boolean).join(" "));
  return {
    business: c.business_name,
    review: c.review_url || (pid ? `https://search.google.com/local/writereview?placeid=${pid}` : null),
    maps: c.maps_url || (pid ? `https://www.google.com/maps/place/?q=place_id:${pid}` : null),
    search: pid ? `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${pid}` : `https://www.google.com/search?q=${q}`,
    website: c.website || null,
    place_id: pid,
  };
}
