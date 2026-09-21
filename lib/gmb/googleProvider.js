/**
 * GoogleGMBProvider - real Google Business Profile API.
 * Same interface as MockGMBProvider, so switching is one env var:
 *   GMB_PROVIDER=google
 *
 * Auth model: your OAuth app, the client's token.
 * getAccessTokenForClient(clientId) returns the token that client granted, or the
 * agency-wide GOOGLE_REFRESH_TOKEN when your agency account is a Manager instead.
 *
 * Endpoints (2026):
 *   accounts     GET  https://mybusinessaccountmanagement.googleapis.com/v1/accounts
 *   locations    GET  https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations
 *   posts        GET/POST https://mybusiness.googleapis.com/v4/{account}/{location}/localPosts
 *   reviews      GET  https://mybusiness.googleapis.com/v4/{account}/{location}/reviews
 *   performance  GET  https://businessprofileperformance.googleapis.com/v1/{location}:fetchMultiDailyMetricsTimeSeries
 *
 * Access is approval-gated: a new Cloud project starts at 0 QPM until Google
 * approves your Basic API Access application.
 */
import { one, insert, query } from "../db.js";
import { getAccessTokenForClient } from "./googleAuth.js";

const ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4 = "https://mybusiness.googleapis.com/v4";
const PERF = "https://businessprofileperformance.googleapis.com/v1";

const LOCATION_FIELDS =
  "name,title,storefrontAddress,phoneNumbers,websiteUri,categories,regularHours,metadata";

export class GoogleGMBProvider {
  constructor() {
    this.name = "google";
    this.isMock = false;
  }

  isConfigured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  async #call(clientId, url, { method = "GET", body = null } = {}) {
    const token = await getAccessTokenForClient(clientId);
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 400);
      if (res.status === 429) detail = "quota exceeded (429) - spread requests through the day or request a quota increase";
      if (res.status === 403 && text.includes("has not been used")) {
        detail = "API not enabled or quota is still 0 - your project has not been approved for Business Profile API access yet";
      }
      throw new Error(`Google API ${res.status}: ${detail}`);
    }
    return text ? JSON.parse(text) : {};
  }

  /** Every account the connected user owns or manages (personal, org, location group). */
  async listAccounts(clientId) {
    const data = await this.#call(clientId, `${ACCOUNTS}/accounts?pageSize=100`);
    return data.accounts || [];
  }

  /** Every location under one account. */
  async listLocations(clientId, accountName) {
    const url = `${INFO}/${accountName}/locations?readMask=${encodeURIComponent(LOCATION_FIELDS)}&pageSize=100`;
    const data = await this.#call(clientId, url);
    return data.locations || [];
  }

  /**
   * Pull everything the connected account can see and store it on the client row.
   * Called by /api/gmb/sync right after the client finishes OAuth.
   */
  async syncClient(clientId, { locationName = null } = {}) {
    const accounts = await this.listAccounts(clientId);
    const found = [];
    for (const account of accounts) {
      const locations = await this.listLocations(clientId, account.name);
      for (const loc of locations) found.push({ account: account.name, location: loc });
    }
    const chosen = locationName
      ? found.find((f) => f.location.name === locationName)
      : found[0];
    return { accounts, locations: found, chosen };
  }

  async #ids(clientId) {
    const row = await one("SELECT google_account_id, google_location_name FROM clients WHERE id=?", [clientId]);
    if (!row?.google_account_id || !row?.google_location_name) {
      throw new Error("This client has no Google location selected yet. Run the sync after connecting.");
    }
    return row;
  }

  async getProfile(clientId) {
    const { google_location_name } = await this.#ids(clientId);
    const loc = await this.#call(
      clientId,
      `${INFO}/${google_location_name}?readMask=${encodeURIComponent(LOCATION_FIELDS)}`
    );
    const addr = loc.storefrontAddress || {};
    return {
      is_mock: false,
      location_id: loc.name,
      business_name: loc.title,
      category: loc.categories?.primaryCategory?.displayName || "",
      address: [...(addr.addressLines || []), addr.locality, addr.administrativeArea].filter(Boolean).join(", "),
      phone: loc.phoneNumbers?.primaryPhone || "",
      website: loc.websiteUri || "",
      services: [],
      opening_hours: loc.regularHours || {},
      rating: 0,
      review_count: 0,
      connection_status: "GOOGLE_CONNECTED",
    };
  }

  async getPosts(clientId, limit = 20) {
    const { google_account_id, google_location_name } = await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();
    const data = await this.#call(
      clientId,
      `${V4}/${google_account_id}/locations/${locId}/localPosts?pageSize=${Number(limit)}`
    );
    return (data.localPosts || []).map((p) => ({
      id: p.name,
      external_id: p.name,
      title: p.summary?.slice(0, 120) || "",
      description: p.summary || "",
      cta: p.callToAction?.actionType || "",
      image_url: p.media?.[0]?.googleUrl || null,
      post_type: p.topicType || "STANDARD",
      status: p.state || "LIVE",
      published_at: p.createTime,
      is_mock: false,
    }));
  }

  /** Real publish. Runs only when the client granted access and quota is approved. */
  async createPost(clientId, post) {
    const { google_account_id, google_location_name } = await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();

    const payload = {
      languageCode: "en",
      summary: [post.title, post.description].filter(Boolean).join("\n\n").slice(0, 1500),
      topicType: "STANDARD",
      ...(post.cta_url
        ? { callToAction: { actionType: "LEARN_MORE", url: post.cta_url } }
        : {}),
      ...(post.public_image_url ? { media: [{ mediaFormat: "PHOTO", sourceUrl: post.public_image_url }] } : {}),
    };

    const created = await this.#call(
      clientId,
      `${V4}/${google_account_id}/locations/${locId}/localPosts`,
      { method: "POST", body: payload }
    );

    const tenantRow = await one("SELECT tenant_id FROM clients WHERE id=?", [clientId]);
    const id = await insert("gmb_posts", {
      tenant_id: post.tenant_id || tenantRow?.tenant_id || null,
      client_id: clientId,
      task_id: post.task_id || null,
      title: post.title,
      description: post.description,
      cta: post.cta,
      image_url: post.image_url,
      post_type: post.post_type,
      status: "PUBLISHED",
      provider: "google",
      is_mock: 0,
      external_id: created.name || null,
      published_at: new Date(),
    });

    return { id, external_id: created.name, is_mock: false, published_at: new Date().toISOString() };
  }

  async getReviews(clientId) {
    const { google_account_id, google_location_name } = await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();
    const data = await this.#call(
      clientId,
      `${V4}/${google_account_id}/locations/${locId}/reviews?pageSize=50`
    );
    return {
      is_mock: false,
      average_rating: data.averageRating || 0,
      total: data.totalReviewCount || 0,
      items: (data.reviews || []).map((r) => ({
        id: r.reviewId,
        author: r.reviewer?.displayName || "Google user",
        rating: r.starRating,
        comment: r.comment || "",
        created_at: r.createTime,
        replied: Boolean(r.reviewReply),
      })),
      note: null,
    };
  }

  async getPerformance(clientId, days = 30) {
    const { google_location_name } = await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();
    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);
    const metrics = [
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
      "WEBSITE_CLICKS",
      "CALL_CLICKS",
      "BUSINESS_DIRECTION_REQUESTS",
    ];
    const params = new URLSearchParams();
    for (const m of metrics) params.append("dailyMetrics", m);
    params.set("dailyRange.start_date.year", String(start.getFullYear()));
    params.set("dailyRange.start_date.month", String(start.getMonth() + 1));
    params.set("dailyRange.start_date.day", String(start.getDate()));
    params.set("dailyRange.end_date.year", String(end.getFullYear()));
    params.set("dailyRange.end_date.month", String(end.getMonth() + 1));
    params.set("dailyRange.end_date.day", String(end.getDate()));

    const data = await this.#call(
      clientId,
      `${PERF}/locations/${locId}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`
    );

    const byDate = new Map();
    for (const series of data.multiDailyMetricTimeSeries || []) {
      for (const item of series.dailyMetricTimeSeries || []) {
        const metric = item.dailyMetric;
        for (const point of item.timeSeries?.datedValues || []) {
          const d = point.date;
          const key = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
          const row = byDate.get(key) || { stat_date: key, views: 0, clicks: 0, calls: 0, direction_requests: 0 };
          const value = Number(point.value || 0);
          if (metric.includes("IMPRESSIONS")) row.views += value;
          else if (metric === "WEBSITE_CLICKS") row.clicks += value;
          else if (metric === "CALL_CLICKS") row.calls += value;
          else if (metric === "BUSINESS_DIRECTION_REQUESTS") row.direction_requests += value;
          byDate.set(key, row);
        }
      }
    }
    return { is_mock: false, series: [...byDate.values()].sort((a, b) => a.stat_date.localeCompare(b.stat_date)) };
  }

  /** Store fetched metrics so analytics keeps working offline. */
  async cachePerformance(clientId) {
    const { series } = await this.getPerformance(clientId, 30);
    await query("DELETE FROM gmb_performance WHERE client_id=? AND is_mock=0", [clientId]);
    for (const row of series) {
      const tRow = await one("SELECT tenant_id FROM clients WHERE id=?", [clientId]);
      await insert("gmb_performance", { tenant_id: tRow?.tenant_id || null, client_id: clientId, ...row, is_mock: 0 });
    }
    return series.length;
  }
}
