import { one, query, parseJson } from "../db.js";

/**
 * Client Knowledge Base - the ONLY source of business facts given to the AI.
 * Everything here comes from the database, so the model cannot invent
 * services, prices, awards or certifications.
 */
export async function buildKnowledge(clientId) {
  const client = await one("SELECT * FROM clients WHERE id=?", [clientId]);
  if (!client) throw new Error(`Client ${clientId} not found`);

  const [services, locations, keywords, profile, previousPosts] = await Promise.all([
    query("SELECT name, description FROM gmb_services WHERE client_id=? ORDER BY id", [clientId]),
    query("SELECT name FROM target_locations WHERE client_id=? ORDER BY id", [clientId]),
    query("SELECT keyword, kw_type, priority, source FROM keywords WHERE client_id=? ORDER BY relevance_score DESC", [clientId]),
    one("SELECT * FROM gmb_profiles WHERE client_id=? LIMIT 1", [clientId]),
    query(
      `SELECT title, post_type, published_at FROM gmb_posts
        WHERE client_id=? ORDER BY COALESCE(published_at, created_at) DESC LIMIT 10`,
      [clientId]
    ),
  ]);

  const recentTopics = await query(
    `SELECT topic FROM ai_tasks WHERE client_id=? AND topic IS NOT NULL ORDER BY id DESC LIMIT 10`,
    [clientId]
  );

  return {
    client_id: client.id,
    business: client.business_name,
    category: client.business_category,
    description: client.description || "",
    location: [client.address, client.city, client.state].filter(Boolean).join(", "),
    city: client.city,
    state: client.state,
    country: client.country,
    phone: client.phone,
    website: client.website,
    services: services.map((s) => s.name),
    service_details: services,
    target_locations: locations.map((l) => l.name),
    keywords: keywords.map((k) => k.keyword),
    client_keywords: keywords.filter((k) => k.source === "CLIENT").map((k) => k.keyword),
    tone: client.content_tone,
    language: client.preferred_language,
    posting_frequency: client.posting_frequency,
    approved_claims: parseJson(client.approved_claims, []),
    prohibited_claims: parseJson(client.prohibited_claims, []),
    opening_hours: profile ? parseJson(profile.opening_hours, {}) : {},
    gmb_location_id: client.gmb_location_id,
    previous_posts: previousPosts.map((p) => ({ title: p.title, type: p.post_type })),
    recent_topics: recentTopics.map((t) => t.topic).filter(Boolean),
  };
}

/** Compact string form injected into every prompt. */
export function knowledgeBlock(kb) {
  return [
    "=== VERIFIED CLIENT DATA (only facts you may use) ===",
    `Business: ${kb.business}`,
    `Category: ${kb.category}`,
    `Location: ${kb.location}`,
    `City: ${kb.city}`,
    `Phone: ${kb.phone || "not provided"}`,
    `Website: ${kb.website || "not provided"}`,
    `Description: ${kb.description || "not provided"}`,
    `Services: ${kb.services.join(", ") || "none listed"}`,
    `Target locations: ${kb.target_locations.join(", ") || kb.city}`,
    `Client keywords: ${kb.client_keywords.join(", ") || "none"}`,
    `Approved claims: ${kb.approved_claims.length ? kb.approved_claims.join(", ") : "none"}`,
    `Prohibited claims: ${kb.prohibited_claims.length ? kb.prohibited_claims.join(", ") : "none"}`,
    `Tone: ${kb.tone}`,
    `Language: ${kb.language}`,
    `Recent post titles: ${kb.previous_posts.map((p) => p.title).join(" | ") || "none"}`,
    `Recent topics: ${kb.recent_topics.join(" | ") || "none"}`,
    "=== END VERIFIED CLIENT DATA ===",
  ].join("\n");
}
