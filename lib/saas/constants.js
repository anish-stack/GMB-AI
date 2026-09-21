/** Platform-wide SaaS constants: roles, permissions, quota metrics, credit costs. */

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN", // platform owner (tenant_id = NULL)
  OWNER: "OWNER",             // tenant admin / agency owner
  MANAGER: "MANAGER",         // can manage clients + approve + publish
  MEMBER: "MEMBER",           // reviewer / employee
};

export const TENANT_ROLES = [ROLES.OWNER, ROLES.MANAGER, ROLES.MEMBER];

export const ROLE_LABEL = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  MEMBER: "Member",
};

/** Permission matrix. SUPER_ADMIN implicitly has everything. */
export const PERMISSIONS = {
  OWNER: [
    "client.view", "client.create", "client.edit", "client.delete",
    "task.view", "task.edit", "task.approve", "task.reject", "task.publish", "task.generate", "task.bulk",
    "calendar.view", "calendar.edit",
    "keyword.view", "keyword.edit",
    "gmb.view", "gmb.edit", "gmb.connect",
    "analytics.view",
    "team.view", "team.invite", "team.edit", "team.remove",
    "billing.view", "billing.manage",
    "settings.view", "settings.edit",
    "apikey.manage",
  ],
  MANAGER: [
    "client.view", "client.create", "client.edit",
    "task.view", "task.edit", "task.approve", "task.reject", "task.publish", "task.generate", "task.bulk",
    "calendar.view", "calendar.edit",
    "keyword.view", "keyword.edit",
    "gmb.view", "gmb.edit",
    "analytics.view",
    "team.view",
    "settings.view",
  ],
  MEMBER: [
    "client.view",
    "task.view", "task.edit", "task.approve", "task.reject", "task.generate",
    "calendar.view",
    "keyword.view",
    "gmb.view",
    "analytics.view",
  ],
};

export const SUB_STATUS = {
  TRIALING: "TRIALING",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
};

export const TENANT_STATUS = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  CANCELLED: "CANCELLED",
};

/** Usage metrics tracked per tenant per billing month. */
export const METRICS = {
  POSTS_GENERATED: "posts_generated",
  POSTS_PUBLISHED: "posts_published",
  AI_CALLS: "ai_calls",
  IMAGES: "images",
  CREDITS: "credits",
};

/** Quota keys map to plan columns. -1 anywhere means unlimited. */
export const LIMIT_KEYS = [
  "max_clients",
  "max_team_members",
  "max_gmb_profiles",
  "max_posts_month",
  "max_scheduled_posts",
  "max_keywords_client",
  "ai_credits_month",
];

export const FEATURE_KEYS = [
  "f_image_generation",
  "f_bulk_actions",
  "f_advanced_analytics",
  "f_api_access",
  "f_white_label",
  "f_google_publish",
  "f_auto_publish",
  "f_priority_support",
  "f_export_reports",
];

export const FEATURE_LABEL = {
  f_image_generation: "AI image generation",
  f_bulk_actions: "Bulk approve / reject",
  f_advanced_analytics: "Advanced analytics",
  f_api_access: "REST API access",
  f_white_label: "White label branding",
  f_google_publish: "Live Google publishing",
  f_auto_publish: "Auto publish (no manual approval)",
  f_priority_support: "Priority support",
  f_export_reports: "Export reports (CSV)",
};

export const LIMIT_LABEL = {
  max_clients: "Clients",
  max_team_members: "Team members",
  max_gmb_profiles: "GMB profiles",
  max_posts_month: "Posts per month",
  max_scheduled_posts: "Scheduled posts",
  max_keywords_client: "Keywords per client",
  ai_credits_month: "AI credits per month",
};

/** Default credits charged per AI unit. Overridable in platform_settings.credit_costs */
export const DEFAULT_CREDIT_COSTS = {
  research: 1,
  keyword: 1,
  topic: 1,
  content: 2,
  hashtag: 1,
  qa: 1,
  recommendation: 1,
  embedding: 0,
  image: 5,
};

export const DEFAULT_PLATFORM_SETTINGS = {
  platform_name: "GMB AI Cloud",
  support_email: "support@example.com",
  currency: "INR",
  tax_percent: 18,
  default_trial_days: 14,
  allow_signup: 1,
  default_plan_slug: "free",
  grace_days_past_due: 5,
  invoice_prefix: "INV",
  razorpay_enabled: 0,
  razorpay_key_id: "",
  razorpay_key_secret: "",
  credit_costs: DEFAULT_CREDIT_COSTS,
};

export class QuotaError extends Error {
  constructor(message, code = "QUOTA_EXCEEDED", meta = {}) {
    super(message);
    this.name = "QuotaError";
    this.code = code;
    this.status = 402;
    this.meta = meta;
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that") {
    super(message);
    this.name = "ForbiddenError";
    this.code = "FORBIDDEN";
    this.status = 403;
  }
}

export function isUnlimited(v) {
  return Number(v) < 0;
}

export function formatLimit(v) {
  return isUnlimited(v) ? "Unlimited" : String(v);
}
