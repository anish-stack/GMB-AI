import { query, one, insert, update, parseJson } from "../db.js";
import { SUB_STATUS, LIMIT_KEYS, FEATURE_KEYS, QuotaError } from "./constants.js";
import { getSettings, nextInvoiceNo } from "./settings.js";
import { resetPlanCredits, grantCredits } from "./credits.js";
import { audit, notify } from "./audit.js";

function iso(d) {
  return d.toISOString().slice(0, 10);
}

export function periodEndFrom(start, cycle) {
  const d = new Date(start);
  if (cycle === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  d.setDate(d.getDate() - 1);
  return d;
}

export async function listPlans({ publicOnly = false, activeOnly = true } = {}) {
  const where = [];
  if (publicOnly) where.push("is_public=1");
  if (activeOnly) where.push("is_active=1");
  const rows = await query(
    `SELECT * FROM plans ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY sort_order, price_monthly`
  );
  return rows.map((p) => ({ ...p, highlights: parseJson(p.highlights, []) }));
}

export async function getPlan(id) {
  const p = await one("SELECT * FROM plans WHERE id=?", [id]);
  return p ? { ...p, highlights: parseJson(p.highlights, []) } : null;
}

export async function savePlan(payload, id = null) {
  const data = {
    name: payload.name,
    slug: payload.slug,
    tagline: payload.tagline || null,
    description: payload.description || null,
    currency: payload.currency || "INR",
    price_monthly: Number(payload.price_monthly || 0),
    price_yearly: Number(payload.price_yearly || 0),
    trial_days: Number(payload.trial_days || 0),
    credit_rollover: payload.credit_rollover ? 1 : 0,
    highlights: Array.isArray(payload.highlights)
      ? payload.highlights
      : String(payload.highlights || "").split("\n").map((s) => s.trim()).filter(Boolean),
    is_public: payload.is_public ? 1 : 0,
    is_active: payload.is_active === undefined ? 1 : payload.is_active ? 1 : 0,
    sort_order: Number(payload.sort_order || 0),
  };
  for (const k of LIMIT_KEYS) data[k] = Number(payload[k] ?? 0);
  for (const k of FEATURE_KEYS) data[k] = payload[k] ? 1 : 0;

  if (id) {
    await update("plans", id, data);
    return id;
  }
  return insert("plans", data);
}

export async function deletePlan(id) {
  const used = await one("SELECT COUNT(*) AS n FROM subscriptions WHERE plan_id=?", [id]);
  if (Number(used.n) > 0) {
    await update("plans", id, { is_active: 0, is_public: 0 });
    return { archived: true };
  }
  await query("DELETE FROM plans WHERE id=?", [id]);
  return { deleted: true };
}

/** Create the first subscription for a tenant. */
export async function startSubscription({ tenantId, planId, billingCycle = "MONTHLY", trialDays = 0, actor = "system" }) {
  const plan = await getPlan(planId);
  if (!plan) throw new Error("Plan not found");

  const start = new Date();
  const end = periodEndFrom(start, billingCycle);
  const price = billingCycle === "YEARLY" ? Number(plan.price_yearly) : Number(plan.price_monthly);
  const trialing = Number(trialDays) > 0 && price > 0;
  const trialEnds = trialing ? new Date(Date.now() + Number(trialDays) * 86400000) : null;

  const subId = await insert("subscriptions", {
    tenant_id: tenantId,
    plan_id: planId,
    status: trialing ? SUB_STATUS.TRIALING : SUB_STATUS.ACTIVE,
    billing_cycle: billingCycle,
    price,
    currency: plan.currency,
    trial_ends_at: trialEnds,
    current_period_start: iso(start),
    current_period_end: iso(trialing ? trialEnds : end),
    overrides: {},
  });

  await resetPlanCredits(tenantId, plan.ai_credits_month, { rollover: false });
  await insert("subscription_events", {
    subscription_id: subId,
    tenant_id: tenantId,
    event: "CREATED",
    to_plan_id: planId,
    actor,
    note: trialing ? `${trialDays}-day trial` : "Direct activation",
  });

  if (price > 0 && !trialing) {
    await createSubscriptionInvoice({ tenantId, subscriptionId: subId, plan, billingCycle, start, end });
  }
  return { id: subId, planId, status: trialing ? SUB_STATUS.TRIALING : SUB_STATUS.ACTIVE };
}

export async function getSubscription(tenantId) {
  return one(
    `SELECT s.*, p.name AS plan_name, p.slug AS plan_slug
       FROM subscriptions s JOIN plans p ON p.id=s.plan_id
      WHERE s.tenant_id=? ORDER BY s.id DESC LIMIT 1`,
    [tenantId]
  );
}

/** Move a tenant to a different plan. Credits are re-allocated to the new plan amount. */
export async function changePlan({ tenantId, planId, billingCycle = null, actor = "system", note = null, resetCredits = true }) {
  const sub = await getSubscription(tenantId);
  if (!sub) throw new Error("Tenant has no subscription");
  const plan = await getPlan(planId);
  if (!plan) throw new Error("Plan not found");

  const cycle = billingCycle || sub.billing_cycle;
  const start = new Date();
  const end = periodEndFrom(start, cycle);
  const price = cycle === "YEARLY" ? Number(plan.price_yearly) : Number(plan.price_monthly);
  const upgrade = price >= Number(sub.price);

  await update("subscriptions", sub.id, {
    plan_id: planId,
    billing_cycle: cycle,
    price,
    currency: plan.currency,
    status: SUB_STATUS.ACTIVE,
    current_period_start: iso(start),
    current_period_end: iso(end),
    cancel_at_period_end: 0,
    cancelled_at: null,
  });

  if (resetCredits) await resetPlanCredits(tenantId, plan.ai_credits_month, { rollover: plan.credit_rollover === 1 });

  await insert("subscription_events", {
    subscription_id: sub.id,
    tenant_id: tenantId,
    event: upgrade ? "UPGRADED" : "DOWNGRADED",
    from_plan_id: sub.plan_id,
    to_plan_id: planId,
    actor,
    note,
  });

  let invoice = null;
  if (price > 0) {
    invoice = await createSubscriptionInvoice({ tenantId, subscriptionId: sub.id, plan, billingCycle: cycle, start, end });
  }

  await notify({
    tenantId,
    type: "BILLING",
    title: `Plan changed to ${plan.name}`,
    body: `Billing cycle: ${cycle.toLowerCase()}`,
    link: "/billing",
  });

  return { subscriptionId: sub.id, planId, price, invoice };
}

export async function renewSubscription({ tenantId, actor = "system" }) {
  const sub = await getSubscription(tenantId);
  if (!sub) throw new Error("Tenant has no subscription");
  const plan = await getPlan(sub.plan_id);
  const start = new Date(`${sub.current_period_end}T00:00:00`);
  start.setDate(start.getDate() + 1);
  const end = periodEndFrom(start, sub.billing_cycle);

  await update("subscriptions", sub.id, {
    status: SUB_STATUS.ACTIVE,
    current_period_start: iso(start),
    current_period_end: iso(end),
  });
  await resetPlanCredits(tenantId, plan.ai_credits_month, { rollover: plan.credit_rollover === 1 });
  await insert("subscription_events", {
    subscription_id: sub.id,
    tenant_id: tenantId,
    event: "RENEWED",
    to_plan_id: sub.plan_id,
    actor,
  });
  if (Number(sub.price) > 0) {
    await createSubscriptionInvoice({ tenantId, subscriptionId: sub.id, plan, billingCycle: sub.billing_cycle, start, end });
  }
  return { ok: true, periodEnd: iso(end) };
}

export async function cancelSubscription({ tenantId, immediate = false, actor = "system", reason = null }) {
  const sub = await getSubscription(tenantId);
  if (!sub) throw new Error("Tenant has no subscription");
  if (immediate) {
    await update("subscriptions", sub.id, {
      status: SUB_STATUS.CANCELLED,
      cancelled_at: new Date(),
      cancel_at_period_end: 0,
    });
  } else {
    await update("subscriptions", sub.id, { cancel_at_period_end: 1 });
  }
  await insert("subscription_events", {
    subscription_id: sub.id,
    tenant_id: tenantId,
    event: "CANCELLED",
    from_plan_id: sub.plan_id,
    actor,
    note: reason,
  });
  return { ok: true, immediate };
}

/** Super admin per-tenant limit/feature overrides. */
export async function setOverrides({ tenantId, overrides, actor = "system" }) {
  const sub = await getSubscription(tenantId);
  if (!sub) throw new Error("Tenant has no subscription");
  const clean = {};
  for (const [k, v] of Object.entries(overrides || {})) {
    if (LIMIT_KEYS.includes(k) && v !== "" && v !== null) clean[k] = Number(v);
    if (FEATURE_KEYS.includes(k) && v !== "" && v !== null) clean[k] = v ? 1 : 0;
  }
  await update("subscriptions", sub.id, { overrides: clean });
  await insert("subscription_events", {
    subscription_id: sub.id,
    tenant_id: tenantId,
    event: "OVERRIDE",
    actor,
    note: JSON.stringify(clean).slice(0, 400),
  });
  return clean;
}

export async function extendPeriod({ tenantId, days, actor = "system" }) {
  const sub = await getSubscription(tenantId);
  if (!sub) throw new Error("Tenant has no subscription");
  const end = new Date(`${sub.current_period_end}T00:00:00`);
  end.setDate(end.getDate() + Number(days || 0));
  await update("subscriptions", sub.id, { current_period_end: iso(end), status: SUB_STATUS.ACTIVE });
  await insert("subscription_events", {
    subscription_id: sub.id,
    tenant_id: tenantId,
    event: "RENEWED",
    actor,
    note: `Extended by ${days} days`,
  });
  return iso(end);
}

// ---------------- invoices ----------------

export async function createInvoice({ tenantId, subscriptionId = null, type = "MANUAL", items = [], couponCode = null, periodStart = null, periodEnd = null, notes = null, status = "DUE" }) {
  const settings = await getSettings();
  const subtotal = items.reduce((s, i) => s + Number(i.amount || 0), 0);

  let discount = 0;
  let coupon = null;
  if (couponCode) {
    coupon = await validateCoupon(couponCode, subtotal);
    discount = coupon.amountOff;
  }

  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * (Number(settings.tax_percent || 0) / 100) * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;

  const invoiceId = await insert("invoices", {
    invoice_no: await nextInvoiceNo(),
    tenant_id: tenantId,
    subscription_id: subscriptionId,
    type,
    subtotal,
    discount,
    tax,
    total,
    currency: settings.currency || "INR",
    status,
    coupon_code: couponCode || null,
    period_start: periodStart,
    period_end: periodEnd,
    due_date: iso(new Date(Date.now() + 7 * 86400000)),
    notes,
  });

  for (const item of items) {
    await insert("invoice_items", {
      invoice_id: invoiceId,
      label: item.label,
      qty: Number(item.qty || 1),
      unit_price: Number(item.unit_price || item.amount || 0),
      amount: Number(item.amount || 0),
    });
  }

  if (coupon?.id) {
    await insert("coupon_redemptions", {
      coupon_id: coupon.id,
      tenant_id: tenantId,
      invoice_id: invoiceId,
      amount_off: discount,
    });
    await query("UPDATE coupons SET redeemed_count=redeemed_count+1 WHERE id=?", [coupon.id]);
  }

  return one("SELECT * FROM invoices WHERE id=?", [invoiceId]);
}

async function createSubscriptionInvoice({ tenantId, subscriptionId, plan, billingCycle, start, end }) {
  const price = billingCycle === "YEARLY" ? Number(plan.price_yearly) : Number(plan.price_monthly);
  return createInvoice({
    tenantId,
    subscriptionId,
    type: "SUBSCRIPTION",
    periodStart: iso(start),
    periodEnd: iso(end),
    items: [
      {
        label: `${plan.name} plan (${billingCycle.toLowerCase()})`,
        qty: 1,
        unit_price: price,
        amount: price,
      },
    ],
  });
}

export async function markInvoicePaid({ invoiceId, gateway = "MANUAL", gatewayPaymentId = null, actor = "system" }) {
  const inv = await one("SELECT * FROM invoices WHERE id=?", [invoiceId]);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "PAID") return inv;

  await update("invoices", invoiceId, { status: "PAID", paid_at: new Date() });
  await insert("payments", {
    tenant_id: inv.tenant_id,
    invoice_id: invoiceId,
    amount: inv.total,
    currency: inv.currency,
    gateway,
    gateway_payment_id: gatewayPaymentId,
    status: "SUCCESS",
  });

  if (inv.type === "SUBSCRIPTION" && inv.subscription_id) {
    await update("subscriptions", inv.subscription_id, { status: SUB_STATUS.ACTIVE });
  }

  await notify({
    tenantId: inv.tenant_id,
    type: "BILLING",
    title: `Payment received - ${inv.invoice_no}`,
    body: `${inv.currency} ${inv.total}`,
    link: "/billing",
  });
  await audit({ tenantId: inv.tenant_id, session: { name: actor } }, "INVOICE_PAID", {
    entity: "invoice",
    entityId: invoiceId,
    meta: { total: inv.total, gateway },
  });
  return one("SELECT * FROM invoices WHERE id=?", [invoiceId]);
}

export async function listInvoices({ tenantId = null, status = null, limit = 200 } = {}) {
  const where = [];
  const params = [];
  if (tenantId) { where.push("i.tenant_id=?"); params.push(tenantId); }
  if (status) { where.push("i.status=?"); params.push(status); }
  return query(
    `SELECT i.*, t.name AS tenant_name
       FROM invoices i JOIN tenants t ON t.id=i.tenant_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY i.id DESC LIMIT ${Number(limit)}`,
    params
  );
}

export async function getInvoice(id) {
  const inv = await one(
    `SELECT i.*, t.name AS tenant_name, t.company_email, t.gst_number, t.address, t.city, t.state
       FROM invoices i JOIN tenants t ON t.id=i.tenant_id WHERE i.id=?`,
    [id]
  );
  if (!inv) return null;
  inv.items = await query("SELECT * FROM invoice_items WHERE invoice_id=?", [id]);
  inv.payments = await query("SELECT * FROM payments WHERE invoice_id=?", [id]);
  return inv;
}

// ---------------- coupons ----------------

export async function validateCoupon(code, subtotal) {
  const c = await one("SELECT * FROM coupons WHERE code=? AND is_active=1", [String(code).toUpperCase()]);
  if (!c) throw new QuotaError("Coupon code is not valid", "COUPON_INVALID");
  const today = iso(new Date());
  if (c.valid_from && today < c.valid_from) throw new QuotaError("Coupon is not active yet", "COUPON_INVALID");
  if (c.valid_until && today > c.valid_until) throw new QuotaError("Coupon has expired", "COUPON_EXPIRED");
  if (Number(c.max_redemptions) > 0 && Number(c.redeemed_count) >= Number(c.max_redemptions)) {
    throw new QuotaError("Coupon redemption limit reached", "COUPON_EXHAUSTED");
  }
  const amountOff =
    c.discount_type === "PERCENT"
      ? Math.round(subtotal * (Number(c.discount_value) / 100) * 100) / 100
      : Math.min(subtotal, Number(c.discount_value));
  return { id: c.id, code: c.code, amountOff, coupon: c };
}

export async function listCoupons() {
  return query(
    `SELECT c.*, p.name AS plan_name FROM coupons c
     LEFT JOIN plans p ON p.id=c.applies_to_plan_id ORDER BY c.id DESC`
  );
}

export async function saveCoupon(payload, id = null) {
  const data = {
    code: String(payload.code || "").toUpperCase().trim(),
    description: payload.description || null,
    discount_type: payload.discount_type === "FLAT" ? "FLAT" : "PERCENT",
    discount_value: Number(payload.discount_value || 0),
    max_redemptions: Number(payload.max_redemptions || 0),
    applies_to_plan_id: payload.applies_to_plan_id ? Number(payload.applies_to_plan_id) : null,
    valid_from: payload.valid_from || null,
    valid_until: payload.valid_until || null,
    is_active: payload.is_active === undefined ? 1 : payload.is_active ? 1 : 0,
  };
  if (id) {
    await update("coupons", id, data);
    return id;
  }
  return insert("coupons", data);
}

export async function deleteCoupon(id) {
  await query("DELETE FROM coupons WHERE id=?", [id]);
}

// ---------------- credit packs ----------------

export async function listCreditPacks({ activeOnly = true } = {}) {
  return query(
    `SELECT * FROM credit_packs ${activeOnly ? "WHERE is_active=1" : ""} ORDER BY sort_order, credits`
  );
}

export async function saveCreditPack(payload, id = null) {
  const data = {
    name: payload.name,
    credits: Number(payload.credits || 0),
    price: Number(payload.price || 0),
    currency: payload.currency || "INR",
    is_active: payload.is_active === undefined ? 1 : payload.is_active ? 1 : 0,
    sort_order: Number(payload.sort_order || 0),
  };
  if (id) {
    await update("credit_packs", id, data);
    return id;
  }
  return insert("credit_packs", data);
}

export async function deleteCreditPack(id) {
  await query("DELETE FROM credit_packs WHERE id=?", [id]);
}

/** Tenant buys a credit pack: invoice + (in manual mode) instant credit. */
export async function purchaseCreditPack({ tenantId, packId, autoApprove = true, actor = "system" }) {
  const pack = await one("SELECT * FROM credit_packs WHERE id=? AND is_active=1", [packId]);
  if (!pack) throw new Error("Credit pack not found");

  const invoice = await createInvoice({
    tenantId,
    type: "CREDIT_PACK",
    items: [{ label: `${pack.name} - ${pack.credits} AI credits`, qty: 1, unit_price: pack.price, amount: pack.price }],
    notes: `Credit pack #${pack.id}`,
    status: autoApprove ? "DUE" : "DUE",
  });

  if (autoApprove) {
    await markInvoicePaid({ invoiceId: invoice.id, gateway: "MANUAL", actor });
    await grantCredits(tenantId, pack.credits, {
      bucket: "PURCHASED",
      reason: "TOPUP",
      note: pack.name,
      refType: "invoice",
      refId: invoice.id,
    });
  }
  return { invoice, credits: pack.credits };
}

/** Called by the scheduler: expire/renew subscriptions whose period ended. */
export async function runBillingCycle() {
  const settings = await getSettings();
  const grace = Number(settings.grace_days_past_due || 5);
  const out = { renewed: 0, pastDue: 0, expired: 0, trialsEnded: 0 };

  const trials = await query(
    `SELECT * FROM subscriptions WHERE status='TRIALING' AND trial_ends_at IS NOT NULL AND trial_ends_at < NOW()`
  );
  for (const s of trials) {
    await update("subscriptions", s.id, { status: SUB_STATUS.PAST_DUE });
    await notify({ tenantId: s.tenant_id, type: "BILLING", title: "Trial ended", body: "Add a plan to keep generating posts.", link: "/billing" });
    out.trialsEnded++;
  }

  const due = await query(
    `SELECT * FROM subscriptions WHERE status IN ('ACTIVE') AND current_period_end < CURDATE()`
  );
  for (const s of due) {
    if (Number(s.price) === 0) {
      await renewSubscription({ tenantId: s.tenant_id, actor: "scheduler" });
      out.renewed++;
    } else if (s.cancel_at_period_end) {
      await update("subscriptions", s.id, { status: SUB_STATUS.CANCELLED, cancelled_at: new Date() });
      out.expired++;
    } else {
      const plan = await getPlan(s.plan_id);
      await update("subscriptions", s.id, { status: SUB_STATUS.PAST_DUE });
      await createSubscriptionInvoice({
        tenantId: s.tenant_id,
        subscriptionId: s.id,
        plan,
        billingCycle: s.billing_cycle,
        start: new Date(),
        end: periodEndFrom(new Date(), s.billing_cycle),
      });
      await notify({ tenantId: s.tenant_id, type: "BILLING", title: "Payment due", body: "Your subscription renewal invoice is ready.", link: "/billing" });
      out.pastDue++;
    }
  }

  const stale = await query(
    `SELECT * FROM subscriptions WHERE status='PAST_DUE'
       AND current_period_end < DATE_SUB(CURDATE(), INTERVAL ${grace} DAY)`
  );
  for (const s of stale) {
    await update("subscriptions", s.id, { status: SUB_STATUS.EXPIRED });
    out.expired++;
  }

  return out;
}
