import { one, parseJson } from "../db.js";
import {
  LIMIT_KEYS, FEATURE_KEYS, QuotaError, SUB_STATUS, TENANT_STATUS, isUnlimited,
} from "./constants.js";
import { getUsage, getLiveCounts, currentPeriod } from "./usage.js";
import { getWallet } from "./credits.js";

/** Resolve the tenant's plan + subscription + super-admin overrides into one object. */
export async function resolveEntitlements(tenantId) {
  const tenant = await one("SELECT * FROM tenants WHERE id=?", [tenantId]);
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  const sub = await one(
    `SELECT s.*, p.name AS plan_name, p.slug AS plan_slug, p.${LIMIT_KEYS.join(", p.")},
            p.${FEATURE_KEYS.join(", p.")}, p.credit_rollover, p.price_monthly, p.price_yearly
       FROM subscriptions s JOIN plans p ON p.id=s.plan_id
      WHERE s.tenant_id=?
      ORDER BY s.id DESC LIMIT 1`,
    [tenantId]
  );

  const limits = {};
  const features = {};
  if (sub) {
    for (const k of LIMIT_KEYS) limits[k] = Number(sub[k]);
    for (const k of FEATURE_KEYS) features[k] = Number(sub[k]) === 1;
    const overrides = parseJson(sub.overrides, {}) || {};
    for (const [k, v] of Object.entries(overrides)) {
      if (LIMIT_KEYS.includes(k)) limits[k] = Number(v);
      if (FEATURE_KEYS.includes(k)) features[k] = Number(v) === 1 || v === true;
    }
  } else {
    for (const k of LIMIT_KEYS) limits[k] = 0;
    for (const k of FEATURE_KEYS) features[k] = false;
  }

  const [usage, live, wallet] = await Promise.all([
    getUsage(tenantId),
    getLiveCounts(tenantId),
    getWallet(tenantId),
  ]);

  const now = new Date();
  const periodEnd = sub?.current_period_end ? new Date(`${sub.current_period_end}T23:59:59`) : null;
  const expired = periodEnd ? periodEnd < now : false;
  const status = sub?.status || SUB_STATUS.EXPIRED;

  const blocked =
    tenant.status !== TENANT_STATUS.ACTIVE ||
    !sub ||
    [SUB_STATUS.CANCELLED, SUB_STATUS.EXPIRED].includes(status) ||
    (expired && status !== SUB_STATUS.ACTIVE);

  return {
    tenant,
    subscription: sub || null,
    plan: sub
      ? {
          id: sub.plan_id,
          name: sub.plan_name,
          slug: sub.plan_slug,
          price_monthly: Number(sub.price_monthly),
          price_yearly: Number(sub.price_yearly),
          credit_rollover: Number(sub.credit_rollover) === 1,
        }
      : null,
    limits,
    features,
    usage,
    live,
    wallet,
    period: currentPeriod(),
    status,
    expired,
    blocked,
    daysLeft: periodEnd ? Math.ceil((periodEnd - now) / 86400000) : 0,
  };
}

/** Current usage value that a limit key is measured against. */
export function usedFor(ent, key) {
  switch (key) {
    case "max_clients": return ent.live.clients;
    case "max_team_members": return ent.live.team_members;
    case "max_gmb_profiles": return ent.live.gmb_profiles;
    case "max_scheduled_posts": return ent.live.scheduled_posts;
    case "max_posts_month": return ent.usage.posts_generated;
    case "ai_credits_month": return ent.usage.credits;
    default: return 0;
  }
}

export function remaining(ent, key) {
  const limit = ent.limits[key];
  if (isUnlimited(limit)) return Infinity;
  return Math.max(0, limit - usedFor(ent, key));
}

const LIMIT_MESSAGE = {
  max_clients: "client limit",
  max_team_members: "team member limit",
  max_gmb_profiles: "GMB profile limit",
  max_posts_month: "monthly post limit",
  max_scheduled_posts: "scheduled post limit",
  max_keywords_client: "keyword limit",
  ai_credits_month: "monthly AI credit limit",
};

export function assertActive(ent) {
  if (ent.tenant.status === TENANT_STATUS.SUSPENDED) {
    throw new QuotaError(
      ent.tenant.suspend_reason || "This account is suspended. Contact support.",
      "TENANT_SUSPENDED"
    );
  }
  if (ent.blocked) {
    throw new QuotaError(
      "Your subscription is not active. Renew or upgrade your plan to continue.",
      "SUBSCRIPTION_INACTIVE",
      { status: ent.status }
    );
  }
  return true;
}

export function assertLimit(ent, key, want = 1) {
  assertActive(ent);
  const limit = ent.limits[key];
  if (isUnlimited(limit)) return true;
  const used = usedFor(ent, key);
  if (used + want > limit) {
    throw new QuotaError(
      `You have reached your ${LIMIT_MESSAGE[key] || key} (${used}/${limit}) on the ${ent.plan?.name || "current"} plan. Upgrade to add more.`,
      "LIMIT_REACHED",
      { key, used, limit }
    );
  }
  return true;
}

export function assertFeature(ent, key) {
  assertActive(ent);
  if (!ent.features[key]) {
    throw new QuotaError(
      `This feature is not included in the ${ent.plan?.name || "current"} plan. Upgrade to unlock it.`,
      "FEATURE_LOCKED",
      { key }
    );
  }
  return true;
}

/** Progress bars for the billing screen. */
export function quotaSummary(ent) {
  return LIMIT_KEYS.filter((k) => k !== "max_keywords_client").map((key) => {
    const limit = ent.limits[key];
    const used = Number(usedFor(ent, key) || 0);
    const unlimited = isUnlimited(limit);
    return {
      key,
      used,
      limit,
      unlimited,
      percent: unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100)),
    };
  });
}
