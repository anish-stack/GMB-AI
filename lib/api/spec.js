/**
 * Public API reference - single source for the docs page AND the Postman
 * collection (scripts/build-postman.mjs). Keep in sync with app/api/v1/*.
 */
export const API_VERSION = "v1";

export const ERRORS = [
  [400, "VALIDATION_ERROR", "A parameter is missing or invalid."],
  [401, "INVALID_API_KEY", "Missing, malformed, revoked or unknown key. Also KEY_DISABLED / KEY_EXPIRED."],
  [403, "INSUFFICIENT_SCOPE", "The key lacks the scope this endpoint needs. PLAN_NO_API when the plan has no API access."],
  [404, "NOT_FOUND", "The record doesn't exist in your workspace."],
  [422, "WEEKLY_LIMIT", "Posting plan cap hit. Also TOTAL_LIMIT, PLAN_EXPIRED, OUTSIDE_PLAN, NOT_A_POSTING_DAY, NO_POSTING_PLAN."],
  [429, "RATE_LIMITED", "Too many requests. Wait until X-RateLimit-Reset (see Retry-After)."],
  [503, "MAINTENANCE", "Platform maintenance. Retry later. API_DISABLED when the API is switched off."],
];

const post = {
  id: 812, client_id: 14, status: "READY_FOR_REVIEW", post_type: "Service", topic: "Root canal - what to expect",
  title: "Root canal treatment in Indirapuram: what to expect", description: "Worried about a root canal? …", cta: "Book a visit",
  image_url: "https://cdn.example.com/p/812.jpg", qa_score: 88, scheduled_date: "2026-10-02", published_at: null, created_at: "2026-09-25T10:20:11.000Z", source: "api",
};

export const ENDPOINTS = [
  {
    group: "Account", name: "Who am I", method: "GET", path: "/me", scope: null,
    description: "Returns the workspace and key the request is authenticated with. Use it to verify a key.",
    response: { data: { workspace: { id: 3, name: "Hover Media", status: "ACTIVE", plan: "Agency" }, key: { id: 7, name: "Website", prefix: "gmbk_1a2b3c4d5e", scopes: ["clients:read", "posts:read"], expires_at: null } }, request_id: "0b6f…" },
  },
  {
    group: "Clients", name: "List clients", method: "GET", path: "/clients", scope: "clients:read",
    query: [["page", "integer", "Page number, default 1"], ["limit", "integer", "1-100, default 20"], ["search", "string", "Filter by business name or city"]],
    response: { data: { items: [{ id: 14, business_name: "Smile Dental", category: "Dentist", city: "Ghaziabad", website: "https://smiledental.in", phone: "+91…", active: true, gmb_status: "GOOGLE_CONNECTED", created_at: "2026-08-01T09:00:00.000Z" }], page: 1, limit: 20, total: 1 } },
  },
  {
    group: "Clients", name: "Get client", method: "GET", path: "/clients/{id}", scope: "clients:read",
    description: "Client details with its posting plan usage.",
    response: { data: { id: 14, business_name: "Smile Dental", posting_plan: { state: "ACTIVE", total_posts: 24, used: 14, remaining: 10 } } },
  },
  {
    group: "Clients", name: "Posting plan usage", method: "GET", path: "/clients/{id}/posting-plan", scope: "clients:read",
    description: "Plan window, weekly limit and usage. Counted = scheduled + pending + processing + published (rejected/failed free the slot).",
    response: { data: { state: "ACTIVE", start_date: "2026-09-01", end_date: "2026-10-31", duration_months: 2, posts_per_week: 3, posting_days: [1, 3, 5], total_posts: 24, used: 14, remaining: 10, breakdown: { published: 12, scheduled: 0, pending: 2, processing: 0 }, this_week: { index: 4, start: "2026-09-22", end: "2026-09-28", limit: 3, used: 2, remaining: 1 } } },
  },
  {
    group: "Posts", name: "List posts", method: "GET", path: "/posts", scope: "posts:read",
    query: [["client_id", "integer", "Only this client"], ["status", "string", "PENDING, READY_FOR_REVIEW, NEEDS_REVIEW, APPROVED, REJECTED, PUBLISHED, FAILED"], ["page", "integer", ""], ["limit", "integer", "1-100"]],
    response: { data: { items: [post], page: 1, limit: 20, total: 1 } },
  },
  {
    group: "Posts", name: "Create post", method: "POST", path: "/posts", scope: "posts:write",
    description: "Creates a post slot and (by default) starts AI generation in the background. Enforces the client's posting plan: weekly cap, total cap, plan window, posting days and expiry - exactly like the dashboard. Poll GET /posts/{id} until status is READY_FOR_REVIEW. Limited to 10 requests/min per key.",
    body: [["client_id", "integer", "required"], ["topic", "string", "optional - AI picks one if empty"], ["post_type", "string", "Service, Offer, Educational, Local, Seasonal, … (default Service)"], ["scheduled_date", "YYYY-MM-DD", "default today"], ["generate", "boolean", "default true"]],
    example: { client_id: 14, topic: "Root canal - what to expect", post_type: "Service", scheduled_date: "2026-10-02" },
    status: 201,
    response: { data: { ...post, status: "PENDING", title: null, generation: "started" } },
    errorExample: { error: { code: "WEEKLY_LIMIT", message: "Weekly limit reached: 3 posts per week (week of 2026-09-29 - 2026-10-05).", details: { limit: 3, weekStart: "2026-09-29", weekEnd: "2026-10-05" } }, request_id: "a1c2…" },
  },
  {
    group: "Posts", name: "Get post", method: "GET", path: "/posts/{id}", scope: "posts:read",
    response: { data: post },
  },
  {
    group: "Reviews", name: "List reviews", method: "GET", path: "/clients/{id}/reviews", scope: "reviews:read",
    response: { data: { average_rating: 4.6, total: 212, items: [{ id: "AbFvOq…", author: "Rahul", rating: 5, comment: "Great service", created_at: "2026-09-20T08:00:00Z", reply: null }] } },
  },
  {
    group: "Reports", name: "Performance", method: "GET", path: "/clients/{id}/performance", scope: "reports:read",
    query: [["days", "integer", "7-365, default 30"]],
    response: { data: { days: 30, is_sample_data: false, totals: { views: 4210, website_clicks: 180, calls: 96, directions: 140 }, series: [{ date: "2026-09-01", views: 120, search_views: 80, maps_views: 40, website_clicks: 6, calls: 3, directions: 4 }] } },
  },
];
