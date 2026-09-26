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
      description: client.description || "",
      special_hours: [],
      additional_categories: [],
      maps_url: profile?.map_url || "",
      review_url: "",
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

  /** Sample reviews (clearly mock) so the review inbox can be tried before Google is connected. */
  async getReviews(clientId) {
    const st = mockState(clientId);
    if (!st.reviews) st.reviews = sampleReviews(clientId);
    const items = st.reviews.map((r) => ({ ...r, replied: Boolean(r.reply) }));
    const avg = items.length ? items.reduce((a, r) => a + RATING_NUM[r.rating], 0) / items.length : 0;
    return { is_mock: true, average_rating: Math.round(avg * 10) / 10, total: items.length, items, note: "Sample reviews - connect Google to see real ones." };
  }

  async batchGetReviews(clientIds = []) {
    const out = new Map();
    for (const id of clientIds) out.set(Number(id), (await this.getReviews(id)).items);
    return out;
  }

  async getListingState(clientId) {
    const c = await one("SELECT place_id, latitude, longitude FROM clients WHERE id=?", [clientId]);
    return {
      is_mock: true, title: null, placeId: c?.place_id || null, latitude: c?.latitude ?? null, longitude: c?.longitude ?? null,
      openStatus: "OPEN", duplicate: false, pendingEdits: false, hasVoiceOfMerchant: true, needsVerification: false,
      suspended: false, disabled: false, ownershipConflict: false, waitingForGoogle: false,
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
    const { items } = await this.getReviews(clientId);
    return items.find((r) => r.id === reviewId) || { id: reviewId, is_mock: true, reply: null };
  }

  async replyToReview(clientId, reviewId, reply) {
    const st = mockState(clientId);
    if (!st.reviews) st.reviews = sampleReviews(clientId);
    const updated_at = new Date().toISOString();
    const r = st.reviews.find((x) => x.id === reviewId);
    if (r) r.reply = { comment: String(reply || ""), updated_at };
    return { ok: true, comment: String(reply || ""), updated_at, is_mock: true };
  }

  async deleteReviewReply(clientId, reviewId) {
    const r = mockState(clientId).reviews?.find((x) => x.id === reviewId);
    if (r) r.reply = null;
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

  /** Accepts a day count OR { startDate, endDate, days } - same shape as the Google provider. */
  async getPerformance(clientId, options = {}) {
    const opts = typeof options === "number" ? { days: options } : options || {};
    const valid = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
    let where = "stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";
    let params = [clientId, Math.min(Math.max(Number(opts.days) || 30, 1), 540)];
    if (valid(opts.startDate) && valid(opts.endDate)) {
      where = "stat_date BETWEEN ? AND ?";
      params = [clientId, opts.startDate, opts.endDate];
    }
    const rows = await query(
      `SELECT DATE_FORMAT(stat_date, '%Y-%m-%d') stat_date, SUM(views) views, SUM(clicks) clicks,
              SUM(calls) calls, SUM(direction_requests) direction_requests
         FROM gmb_performance
        WHERE client_id=? AND ${where}
        GROUP BY stat_date ORDER BY stat_date`,
      params
    );
    return { is_mock: true, series: rows.map((r) => ({ ...r, search_views: Number(r.views || 0), maps_views: 0 })) };
  }

  /* ---------- profile helpers used by the edit form ---------- */
  async getAvailableServiceTypes() {
    return { category: null, serviceTypes: [], is_mock: true };
  }

  async searchCategories(clientId, q) {
    const term = String(q || "").toLowerCase();
    return MOCK_CATEGORIES.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 20);
  }

  /* ---------- attributes (in-memory, prototype only) ---------- */
  async getAttributes(clientId) {
    const saved = mockState(clientId).attributes;
    return {
      is_mock: true,
      items: MOCK_ATTRIBUTES.map((a) => ({ ...a, value: saved[a.id] ?? a.value })),
    };
  }

  async updateAttributes(clientId, attrs = []) {
    const saved = mockState(clientId).attributes;
    for (const a of attrs) if (a?.id) saved[a.id] = a.value;
    return { ok: true, changed: attrs.map((a) => a.id), is_mock: true };
  }

  /* ---------- action links ---------- */
  async getActionLinks(clientId) {
    return { is_mock: true, types: MOCK_ACTION_TYPES, items: mockState(clientId).links };
  }

  async createActionLink(clientId, { type, uri, preferred = false }) {
    const link = { id: `mock_link_${Date.now()}`, type, uri, preferred: Boolean(preferred), editable: true, provider: "MERCHANT", updated_at: new Date().toISOString() };
    mockState(clientId).links.push(link);
    return link;
  }

  async updateActionLink(clientId, linkName, patch) {
    const link = mockState(clientId).links.find((l) => l.id === linkName);
    if (link) Object.assign(link, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
    return link || null;
  }

  async deleteActionLink(clientId, linkName) {
    const st = mockState(clientId);
    st.links = st.links.filter((l) => l.id !== linkName);
    return { ok: true, is_mock: true };
  }

  /* ---------- admins ---------- */
  async getAdmins(clientId) {
    return { is_mock: true, items: mockState(clientId).admins };
  }

  async inviteAdmin(clientId, { email, role = "MANAGER" }) {
    const admin = { id: `mock_admin_${Date.now()}`, email, role, pending: true };
    mockState(clientId).admins.push(admin);
    return admin;
  }

  async removeAdmin(clientId, adminName) {
    const st = mockState(clientId);
    st.admins = st.admins.filter((a) => a.id !== adminName);
    return { ok: true, is_mock: true };
  }
}

/* ---------- in-memory mock state (resets on server restart) ---------- */
const g = globalThis;
g.__gmbMockState ||= new Map();
function mockState(clientId) {
  const key = Number(clientId);
  if (!g.__gmbMockState.has(key)) {
    g.__gmbMockState.set(key, {
      attributes: {},
      links: [],
      admins: [{ id: "mock_admin_owner", email: "owner@example.com", role: "PRIMARY_OWNER", pending: false }],
    });
  }
  return g.__gmbMockState.get(key);
}

const MOCK_CATEGORIES = [
  "Dentist", "Dental clinic", "Diagnostic center", "Medical laboratory", "Hospital", "Ambulance service",
  "Restaurant", "Cafe", "Bakery", "Travel agency", "Tour operator", "Printing service", "Digital printer",
  "Marketing agency", "Internet marketing service", "Website designer", "Software company",
  "Air conditioning contractor", "HVAC contractor", "Water purification company", "Hearing aid store",
  "Audiologist", "Beauty salon", "Gym", "Real estate agency", "School", "Coaching center",
].map((name) => ({ id: `categories/gcid:${name.toLowerCase().replace(/\W+/g, "_")}`, name }));

const MOCK_ATTRIBUTES = [
  { id: "attributes/has_wheelchair_accessible_entrance", label: "Wheelchair-accessible entrance", group: "Accessibility", type: "BOOL", repeatable: false, options: [], value: null },
  { id: "attributes/has_wheelchair_accessible_parking", label: "Wheelchair-accessible car park", group: "Accessibility", type: "BOOL", repeatable: false, options: [], value: null },
  { id: "attributes/wi_fi", label: "Wi-Fi", group: "Amenities", type: "ENUM", repeatable: false, options: [{ value: "free_wi_fi", label: "Free Wi-Fi" }, { value: "paid_wi_fi", label: "Paid Wi-Fi" }], value: null },
  { id: "attributes/has_restroom", label: "Toilets", group: "Amenities", type: "BOOL", repeatable: false, options: [], value: null },
  { id: "attributes/pay_credit_card_types_accepted", label: "Payments", group: "Payments", type: "REPEATED_ENUM", repeatable: true, options: [{ value: "visa", label: "Visa" }, { value: "mastercard", label: "Mastercard" }, { value: "rupay", label: "RuPay" }], value: [] },
  { id: "attributes/pay_mobile_nfc", label: "NFC mobile payments", group: "Payments", type: "BOOL", repeatable: false, options: [], value: null },
  { id: "attributes/requires_appointments", label: "Appointment required", group: "Planning", type: "BOOL", repeatable: false, options: [], value: null },
  { id: "attributes/url_appointment", label: "Appointment link", group: "Links", type: "URL", repeatable: false, options: [], value: "" },
];

const MOCK_ACTION_TYPES = [
  { value: "APPOINTMENT", label: "Appointment" },
  { value: "ONLINE_APPOINTMENT", label: "Online appointment" },
  { value: "DINING_RESERVATION", label: "Reservation" },
  { value: "FOOD_ORDERING", label: "Order food" },
  { value: "SHOP_ONLINE", label: "Shop online" },
];

const RATING_NUM = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const SAMPLE = [
  ["Rahul Sharma", "FIVE", "Very professional staff and quick service. Highly recommended!"],
  ["Priya Verma", "FOUR", "Good experience overall, a little wait time on Saturday."],
  ["Amit Kumar", "TWO", "Had to wait 45 minutes even with an appointment. Please improve."],
  ["Neha Gupta", "FIVE", "बहुत अच्छी सर्विस, स्टाफ़ बहुत मददगार है।"],
  ["Vikas Singh", "THREE", "Service was okay but parking is a problem."],
  ["Sana Khan", "FIVE", ""],
];
function sampleReviews(clientId) {
  const now = Date.now();
  return SAMPLE.map(([author, rating, comment], i) => ({
    id: `mock-${clientId}-${i + 1}`,
    author,
    rating,
    comment,
    created_at: new Date(now - (i * 3 + (Number(clientId) % 3)) * 86400000).toISOString(),
    updated_at: new Date(now - (i * 3 + (Number(clientId) % 3)) * 86400000).toISOString(),
    reply: i === 1 ? { comment: "Thank you Priya! We're adding more weekend slots.", updated_at: new Date(now - 86400000).toISOString() } : null,
  }));
}
