import bcrypt from "bcryptjs";
import { query, one, insert, update } from "../db.js";
import { ROLES, TENANT_STATUS } from "./constants.js";
import { slugify } from "../utils.js";
import { startSubscription } from "./billing.js";
import { getWallet } from "./credits.js";
import { audit, notify } from "./audit.js";
import { queueEmail } from "../mail/queue.js";
import { welcomeEmail } from "../mail/templates.js";

async function uniqueSlug(base) {
  let slug = slugify(base) || `tenant-${Date.now()}`;
  let i = 1;
  while (await one("SELECT id FROM tenants WHERE slug=?", [slug])) {
    slug = `${slugify(base)}-${i++}`;
  }
  return slug;
}

/**
 * Creates a tenant + owner user + subscription + wallet in one shot.
 * Used by public signup and by the super admin "Add tenant" form.
 */
export async function provisionTenant({
  companyName,
  ownerName,
  email,
  password,
  phone = null,
  planId = null,
  planSlug = "free",
  billingCycle = "MONTHLY",
  trialDays = null,
  status = TENANT_STATUS.ACTIVE,
  actor = null,
}) {
  const existing = await one("SELECT id FROM users WHERE email=?", [email]);
  if (existing) throw new Error("An account with this email already exists");

  const plan = planId
    ? await one("SELECT * FROM plans WHERE id=?", [planId])
    : await one("SELECT * FROM plans WHERE slug=? AND is_active=1", [planSlug]);
  if (!plan) throw new Error("No plan available. Create a plan first.");

  const tenantId = await insert("tenants", {
    name: companyName,
    slug: await uniqueSlug(companyName),
    company_email: email,
    phone,
    status,
  });

  const userId = await insert("users", {
    tenant_id: tenantId,
    name: ownerName,
    email,
    phone,
    password_hash: await bcrypt.hash(password, 10),
    role: ROLES.OWNER,
    active: 1,
  });

  await update("tenants", tenantId, { owner_user_id: userId });
  await insert("employees", { tenant_id: tenantId, user_id: userId, department: "Management" });
  await query("INSERT IGNORE INTO credit_wallets (tenant_id) VALUES (?)", [tenantId]);

  const sub = await startSubscription({
    tenantId,
    planId: plan.id,
    billingCycle,
    trialDays: trialDays === null ? plan.trial_days : trialDays,
    actor: actor || ownerName,
  });

  await audit({ tenantId, session: { name: actor || ownerName }, role: actor ? ROLES.SUPER_ADMIN : ROLES.OWNER }, "TENANT_CREATED", {
    entity: "tenant",
    entityId: tenantId,
    meta: { plan: plan.slug },
  });
  await notify({
    tenantId: null,
    type: "TENANT",
    title: `New tenant: ${companyName}`,
    body: `${ownerName} signed up on the ${plan.name} plan`,
    link: `/admin/tenants/${tenantId}`,
  });

  // Fire-and-forget: enqueued for a background worker to send, so account
  // creation never waits on an SMTP round-trip (see lib/mail/queue.js).
  const tpl = welcomeEmail({ ownerName, companyName, appUrl: process.env.APP_URL || null });
  await queueEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, template: "welcome", tenantId });

  return { tenantId, userId, subscriptionId: sub.id, planId: plan.id };
}

export async function listTenants({ search = null, status = null } = {}) {
  const where = [];
  const params = [];
  if (search) {
    where.push("(t.name LIKE ? OR t.company_email LIKE ? OR t.slug LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    where.push("t.status=?");
    params.push(status);
  }
  return query(
    `SELECT t.*, u.name AS owner_name, u.email AS owner_email,
            p.name AS plan_name, p.slug AS plan_slug,
            s.status AS sub_status, s.current_period_end, s.billing_cycle, s.price,
            w.plan_credits, w.purchased_credits,
            (SELECT COUNT(*) FROM clients c WHERE c.tenant_id=t.id) AS client_count,
            (SELECT COUNT(*) FROM users us WHERE us.tenant_id=t.id AND us.active=1) AS user_count,
            (SELECT COUNT(*) FROM ai_tasks a WHERE a.tenant_id=t.id) AS task_count
       FROM tenants t
       LEFT JOIN users u ON u.id=t.owner_user_id
       LEFT JOIN subscriptions s ON s.id=(SELECT MAX(id) FROM subscriptions x WHERE x.tenant_id=t.id)
       LEFT JOIN plans p ON p.id=s.plan_id
       LEFT JOIN credit_wallets w ON w.tenant_id=t.id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY t.created_at DESC`,
    params
  );
}

export async function getTenant(id) {
  const tenant = await one(
    `SELECT t.*, u.name AS owner_name, u.email AS owner_email
       FROM tenants t LEFT JOIN users u ON u.id=t.owner_user_id WHERE t.id=?`,
    [id]
  );
  if (!tenant) return null;

  const [users, subscription, invoices, ledger, events, counts] = await Promise.all([
    query("SELECT id,name,email,role,active,last_login_at,created_at FROM users WHERE tenant_id=? ORDER BY id", [id]),
    one(
      `SELECT s.*, p.name AS plan_name, p.slug AS plan_slug
         FROM subscriptions s JOIN plans p ON p.id=s.plan_id
        WHERE s.tenant_id=? ORDER BY s.id DESC LIMIT 1`,
      [id]
    ),
    query("SELECT * FROM invoices WHERE tenant_id=? ORDER BY id DESC LIMIT 20", [id]),
    query("SELECT * FROM credit_ledger WHERE tenant_id=? ORDER BY id DESC LIMIT 25", [id]),
    query(
      `SELECT e.*, fp.name AS from_plan, tp.name AS to_plan
         FROM subscription_events e
         LEFT JOIN plans fp ON fp.id=e.from_plan_id
         LEFT JOIN plans tp ON tp.id=e.to_plan_id
        WHERE e.tenant_id=? ORDER BY e.id DESC LIMIT 25`,
      [id]
    ),
    one(
      `SELECT
         (SELECT COUNT(*) FROM clients WHERE tenant_id=?) AS clients,
         (SELECT COUNT(*) FROM ai_tasks WHERE tenant_id=?) AS tasks,
         (SELECT COUNT(*) FROM gmb_posts WHERE tenant_id=?) AS posts,
         (SELECT COUNT(*) FROM ai_executions WHERE tenant_id=?) AS ai_calls,
         (SELECT ROUND(SUM(estimated_cost),4) FROM ai_executions WHERE tenant_id=?) AS ai_cost`,
      [id, id, id, id, id]
    ),
  ]);

  return {
    ...tenant,
    users,
    subscription,
    invoices,
    ledger,
    events,
    counts,
    wallet: await getWallet(id),
  };
}

export async function updateTenant(id, patch) {
  const allowed = [
    "name", "company_email", "phone", "website", "address", "city", "state",
    "country", "gst_number", "logo_url", "brand_color", "timezone", "notes",
  ];
  const data = {};
  for (const k of allowed) if (patch[k] !== undefined) data[k] = patch[k];
  if (Object.keys(data).length) await update("tenants", id, data);
}

export async function setTenantStatus(id, status, reason = null, ctx = null) {
  await update("tenants", id, { status, suspend_reason: status === TENANT_STATUS.SUSPENDED ? reason : null });
  await audit(ctx, `TENANT_${status}`, { entity: "tenant", entityId: id, meta: { reason } });
  await notify({
    tenantId: id,
    type: status === TENANT_STATUS.ACTIVE ? "INFO" : "WARNING",
    title: status === TENANT_STATUS.ACTIVE ? "Account reactivated" : `Account ${status.toLowerCase()}`,
    body: reason || null,
    link: "/billing",
  });
}

export async function deleteTenant(id) {
  await query("DELETE FROM tenants WHERE id=?", [id]);
}

export async function platformStats() {
  const row = await one(
    `SELECT
       (SELECT COUNT(*) FROM tenants) AS tenants,
       (SELECT COUNT(*) FROM tenants WHERE status='ACTIVE') AS active_tenants,
       (SELECT COUNT(*) FROM tenants WHERE status='SUSPENDED') AS suspended_tenants,
       (SELECT COUNT(*) FROM users WHERE tenant_id IS NOT NULL) AS users,
       (SELECT COUNT(*) FROM clients) AS clients,
       (SELECT COUNT(*) FROM subscriptions WHERE status='ACTIVE') AS active_subs,
       (SELECT COUNT(*) FROM subscriptions WHERE status='TRIALING') AS trials,
       (SELECT COUNT(*) FROM ai_tasks) AS tasks,
       (SELECT COUNT(*) FROM gmb_posts) AS posts,
       (SELECT ROUND(SUM(total),2) FROM invoices WHERE status='PAID') AS revenue,
       (SELECT ROUND(SUM(total),2) FROM invoices WHERE status='DUE') AS outstanding,
       (SELECT ROUND(SUM(estimated_cost),4) FROM ai_executions) AS ai_cost,
       (SELECT SUM(lifetime_used) FROM credit_wallets) AS credits_used`
  );
  const mrr = await one(
    `SELECT ROUND(SUM(CASE WHEN billing_cycle='YEARLY' THEN price/12 ELSE price END),2) AS mrr
       FROM subscriptions WHERE status IN ('ACTIVE','PAST_DUE')`
  );
  return { ...row, mrr: Number(mrr?.mrr || 0) };
}

export async function revenueTrend(months = 6) {
  return query(
    `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS period, ROUND(SUM(total),2) AS revenue, COUNT(*) AS invoices
       FROM invoices
      WHERE status='PAID' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL ${Number(months)} MONTH)
      GROUP BY DATE_FORMAT(paid_at, '%Y-%m') ORDER BY period ASC`
  );
}

export async function planDistribution() {
  return query(
    `SELECT p.name, p.slug, COUNT(s.id) AS tenants
       FROM plans p LEFT JOIN subscriptions s
         ON s.plan_id=p.id AND s.status IN ('ACTIVE','TRIALING','PAST_DUE')
      GROUP BY p.id ORDER BY p.sort_order`
  );
}
