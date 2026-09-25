import { one, query, insert, parseJson } from "../db.js";

/**
 * MockGMBProvider - PROTOTYPE ONLY.
 * Nothing here talks to Google. Every object returned carries is_mock: true.
 */
export class MockGMBProvider {
  constructor() {
    this.name = "mock";
    this.isMock = true;
  }

  async getProfile(clientId) {
    const client = await one("SELECT * FROM clients WHERE id=?", [clientId]);
    if (!client) return null;
    const profile = await one("SELECT * FROM gmb_profiles WHERE client_id=? LIMIT 1", [clientId]);
    const services = await query("SELECT name FROM gmb_services WHERE client_id=?", [clientId]);
    return {
      is_mock: true,
      location_id: client.gmb_location_id,
      business_name: client.business_name,
      category: client.business_category,
      address: [client.address, client.city, client.state].filter(Boolean).join(", "),
      phone: client.phone,
      website: client.website,
      services: services.map((s) => s.name),
      opening_hours: profile ? parseJson(profile.opening_hours, {}) : {},
      rating: profile ? Number(profile.rating) : 0,
      review_count: profile ? profile.review_count : 0,
      connection_status: client.gmb_connection_status,
    };
  }

  async getPosts(clientId, limit = 20) {
    const rows = await query(
      `SELECT * FROM gmb_posts WHERE client_id=? ORDER BY COALESCE(published_at, created_at) DESC LIMIT ${Number(limit)}`,
      [clientId]
    );
    return rows.map((r) => ({ ...r, is_mock: true }));
  }

  /** Simulated publish - writes locally, never calls Google. */
  async createPost(clientId, post) {
    const externalId = `mock_${clientId}_${Date.now()}`;
    const tenantRow = await one("SELECT tenant_id FROM clients WHERE id=?", [clientId]);
    const postId = await insert("gmb_posts", {
      tenant_id: post.tenant_id || tenantRow?.tenant_id || null,
      client_id: clientId,
      task_id: post.task_id || null,
      title: post.title,
      description: post.description,
      cta: post.cta,
      image_url: post.image_url,
      post_type: post.post_type,
      status: "PUBLISHED",
      provider: "mock",
      is_mock: 1,
      external_id: externalId,
      published_at: new Date(),
    });
    return { id: postId, external_id: externalId, is_mock: true, published_at: new Date().toISOString() };
  }

  /** Simulated update - writes locally, never calls Google. postName is gmb_posts.external_id. */
  async updatePost(clientId, postName, post) {
    await query(
      "UPDATE gmb_posts SET title=?, description=?, cta=?, image_url=?, post_type=? WHERE client_id=? AND external_id=?",
      [post.title, post.description, post.cta, post.image_url, post.post_type, clientId, postName]
    );
    return { external_id: postName, is_mock: true, updated_at: new Date().toISOString() };
  }

  /** Simulated delete - marks the local row deleted, never calls Google. */
  async deletePost(clientId, postName) {
    await query("UPDATE gmb_posts SET status='DELETED' WHERE client_id=? AND external_id=?", [clientId, postName]);
    return { ok: true, is_mock: true };
  }

  async getReviews(clientId) {
    const profile = await one("SELECT rating, review_count FROM gmb_profiles WHERE client_id=? LIMIT 1", [clientId]);
    return {
      is_mock: true,
      average_rating: profile ? Number(profile.rating) : 0,
      total: profile ? profile.review_count : 0,
      items: [],
      note: "Review data requires the real Google Business Profile API.",
    };
  }

  async getSearchKeywords(clientId, { startMonth = null, endMonth = null } = {}) {
    return {
      startMonth: startMonth || null,
      endMonth: endMonth || null,
      keywords: [],
      nextPageToken: null,
      is_mock: true,
    };
  }

  async getReview(clientId, reviewId) {
    return { id: reviewId, is_mock: true, reply: null };
  }

  async replyToReview(clientId, reviewId, reply) {
    return { ok: true, comment: String(reply || ""), updated_at: new Date().toISOString(), is_mock: true };
  }

  async deleteReviewReply(clientId, reviewId) {
    return { ok: true, is_mock: true };
  }

  async getMedia(clientId) {
    return [];
  }

  async getMediaItem(clientId, mediaName) {
    return { id: mediaName, is_mock: true };
  }

  async uploadMedia(clientId, { sourceUrl, category } = {}) {
    return {
      id: `mock_media_${Date.now()}`,
      name: `mock_media_${Date.now()}`,
      mediaFormat: "PHOTO",
      category: category || "ADDITIONAL",
      googleUrl: sourceUrl || null,
      thumbnailUrl: sourceUrl || null,
      description: null,
      createTime: new Date().toISOString(),
      is_mock: true,
    };
  }

  async deleteMedia(clientId, mediaName) {
    return { ok: true, is_mock: true };
  }

  async getPerformance(clientId, days = 30) {
    const rows = await query(
      `SELECT stat_date, SUM(views) views, SUM(clicks) clicks, SUM(calls) calls,
              SUM(direction_requests) direction_requests
         FROM gmb_performance
        WHERE client_id=? AND stat_date >= DATE_SUB(CURDATE(), INTERVAL ${Number(days)} DAY)
        GROUP BY stat_date ORDER BY stat_date`,
      [clientId]
    );
    return { is_mock: true, series: rows };
  }
}
