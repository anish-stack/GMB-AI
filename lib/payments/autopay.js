import "server-only";
import crypto from "node:crypto";
import { query, one, insert, update } from "../db.js";
import { razorpayConfig, toPaise } from "./razorpay.js";
import { getSettings } from "../saas/settings.js";
import { getSubscription, getPlan, periodEndFrom, markInvoicePaid, createInvoice } from "../saas/billing.js";
import { resetPlanCredits } from "../saas/credits.js";

/**
 * Razorpay Autopay (Subscriptions API + e-mandate / card / UPI AutoPay).
 *
 *   enable  -> Razorpay plan (per plan + cycle + amount, cached in rzp_plans)
 *           -> Razorpay subscription, first charge on the NEXT renewal date when the
 *              current period is already paid / in trial (no double charge)
 *           -> customer authorises in Razorpay Checkout (subscription_id)
 *   webhook -> subscription.charged: period extended, invoice created + marked PAID
 *              subscription.halted / pending: PAST_DUE · cancelled / completed: off
 *   cancel  -> cancel_at_cycle_end: access stays until the paid period ends
 */
const API = "https://api.razorpay.com/v1";
const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const iso = (d) => new Date(d).toISOString().slice(0, 10);

async function rzp(cfg, path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw bad(`Razorpay: ${j?.error?.description || res.status}`, 502);
  return j;
}

/** Amount actually charged each cycle = plan price + GST (same maths as invoices). */
export async function cycleAmount(plan, cycle) {
  const s = await getSettings();
  const price = cycle === "YEARLY" ? Number(plan.price_yearly) : Number(plan.price_monthly);
  const tax = Math.round(price * (Number(s.tax_percent || 0) / 100) * 100) / 100;
  return { price, tax, total: Math.round((price + tax) * 100) / 100 };
}

async function ensurePlan(cfg, plan, cycle, total) {
  const hit = await one("SELECT rzp_plan_id FROM rzp_plans WHERE plan_id=? AND billing_cycle=? AND amount=?", [plan.id, cycle, total]);
  if (hit) return hit.rzp_plan_id;
  const p = await rzp(cfg, "/plans", {
    method: "POST",
    body: {
      period: cycle === "YEARLY" ? "yearly" : "monthly",
      interval: 1,
      item: { name: `${plan.name} (${cycle === "YEARLY" ? "Yearly" : "Monthly"})`, amount: toPaise(total), currency: "INR", description: `${cfg.brand} subscription` },
      notes: { plan_id: String(plan.id), cycle },
    },
  });
  await query("INSERT IGNORE INTO rzp_plans (plan_id, billing_cycle, amount, rzp_plan_id) VALUES (?,?,?,?)", [plan.id, cycle, total, p.id]);
  return p.id;
}

export async function autopayStatus(tenantId) {
  const sub = await getSubscription(tenantId);
  const cfg = await razorpayConfig();
  if (!sub) return { available: false, reason: "No subscription" };
  const plan = await getPlan(sub.plan_id);
  const amount = plan ? await cycleAmount(plan, sub.billing_cycle) : null;
  return {
    available: cfg.enabled && Boolean(amount?.price),
    reason: !cfg.enabled ? "Online payments are not enabled" : !amount?.price ? "Free plan - nothing to charge" : null,
    status: sub.autopay_status || null,
    subscriptionId: sub.rzp_subscription_id || null,
    nextChargeAt: sub.autopay_next_charge_at || (sub.autopay_status === "ACTIVE" || sub.autopay_status === "AUTHENTICATED" ? sub.current_period_end : null),
    amount,
    cycle: sub.billing_cycle,
    plan: plan?.name,
    periodEnd: sub.current_period_end,
    testMode: cfg.testMode,
  };
}

/** Creates the Razorpay subscription; the browser then opens Checkout with subscription_id. */
export async function startAutopay(tenantId, { actor = "system" } = {}) {
  const cfg = await razorpayConfig();
  if (!cfg.enabled) throw bad("Online payments are not enabled. Ask the admin to configure Razorpay.");
  const sub = await getSubscription(tenantId);
  if (!sub) throw bad("No subscription found.");
  if (["ACTIVE", "AUTHENTICATED"].includes(sub.autopay_status)) throw bad("Autopay is already active.");
  const plan = await getPlan(sub.plan_id);
  const amount = await cycleAmount(plan, sub.billing_cycle);
  if (!amount.price) throw bad("Your plan is free - autopay is not needed.");
  const rzpPlanId = await ensurePlan(cfg, plan, sub.billing_cycle, amount.total);

  // first charge on the next renewal when the current period is already paid / trial
  const periodEnd = new Date(`${iso(sub.current_period_end)}T06:00:00+05:30`);
  const paidAhead = ["ACTIVE", "TRIALING"].includes(sub.status) && periodEnd.getTime() > Date.now() + 15 * 60000;
  const tenant = await one("SELECT name, company_email, phone FROM tenants WHERE id=?", [tenantId]);
  const r = await rzp(cfg, "/subscriptions", {
    method: "POST",
    body: {
      plan_id: rzpPlanId,
      total_count: sub.billing_cycle === "YEARLY" ? 10 : 120,
      quantity: 1,
      customer_notify: 1,
      ...(paidAhead ? { start_at: Math.floor(periodEnd.getTime() / 1000) } : {}),
      notes: { kind: "autopay", tenant_id: String(tenantId), subscription_id: String(sub.id), cycle: sub.billing_cycle },
    },
  });
  await update("subscriptions", sub.id, { rzp_subscription_id: r.id, autopay_status: "CREATED", autopay_next_charge_at: paidAhead ? periodEnd : null });
  await insert("subscription_events", { subscription_id: sub.id, tenant_id: tenantId, event: "AUTOPAY_CREATED", to_plan_id: sub.plan_id, actor, note: r.id }).catch(() => {});
  return {
    keyId: cfg.keyId,
    subscriptionId: r.id,
    name: cfg.brand,
    description: `${plan.name} - autopay ${sub.billing_cycle === "YEARLY" ? "yearly" : "monthly"} ₹${amount.total}`,
    prefill: { name: tenant?.name || "", email: tenant?.company_email || "", contact: tenant?.phone || "" },
    firstChargeOn: paidAhead ? iso(periodEnd) : "today",
  };
}

/** Checkout handler -> verify signature (payment_id|subscription_id). */
export async function confirmAutopay(tenantId, { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }) {
  const cfg = await razorpayConfig();
  const sub = await getSubscription(tenantId);
  if (!sub || sub.rzp_subscription_id !== razorpay_subscription_id) throw bad("Autopay session not found - start again.");
  const expected = crypto.createHmac("sha256", cfg.keySecret).update(`${razorpay_payment_id}|${razorpay_subscription_id}`).digest("hex");
  const a = Buffer.from(String(razorpay_signature || ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw bad("Payment signature mismatch.");
  await update("subscriptions", sub.id, { autopay_status: "AUTHENTICATED", cancel_at_period_end: 0 });
  return autopayStatus(tenantId);
}

export async function cancelAutopay(tenantId, { actor = "system" } = {}) {
  const cfg = await razorpayConfig();
  const sub = await getSubscription(tenantId);
  if (!sub?.rzp_subscription_id) throw bad("Autopay is not set up.");
  if (cfg.enabled) await rzp(cfg, `/subscriptions/${sub.rzp_subscription_id}/cancel`, { method: "POST", body: { cancel_at_cycle_end: 1 } }).catch((e) => {
    // already cancelled / never authorised -> just turn it off locally
    if (!/cancel|not|completed|created/i.test(e.message)) throw e;
  });
  await update("subscriptions", sub.id, { autopay_status: "CANCELLED", autopay_next_charge_at: null });
  await insert("subscription_events", { subscription_id: sub.id, tenant_id: tenantId, event: "AUTOPAY_CANCELLED", from_plan_id: sub.plan_id, actor }).catch(() => {});
  return autopayStatus(tenantId);
}

/** subscription.charged -> new period + PAID invoice (idempotent per payment id). */
async function charged(sub, payment) {
  if (await one("SELECT id FROM payments WHERE gateway='RAZORPAY' AND gateway_payment_id=?", [payment.id])) return { duplicate: true };
  const plan = await getPlan(sub.plan_id);
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const prevEnd = new Date(`${iso(sub.current_period_end)}T00:00:00Z`);
  let start = new Date(prevEnd.getTime() + 86400000);
  if (start < new Date(today.getTime() - 3 * 86400000)) start = today; // long lapse -> restart from today
  const end = periodEndFrom(start, sub.billing_cycle);
  let inv = await one("SELECT * FROM invoices WHERE tenant_id=? AND subscription_id=? AND type='SUBSCRIPTION' AND status='DUE' ORDER BY id DESC LIMIT 1", [sub.tenant_id, sub.id]);
  if (!inv) {
    const price = sub.billing_cycle === "YEARLY" ? Number(plan.price_yearly) : Number(plan.price_monthly);
    inv = await createInvoice({
      tenantId: sub.tenant_id, subscriptionId: sub.id, type: "SUBSCRIPTION",
      items: [{ label: `${plan.name} plan (${sub.billing_cycle.toLowerCase()}) - autopay`, qty: 1, unit_price: price, amount: price }],
      periodStart: iso(start), periodEnd: iso(end), notes: "Razorpay autopay",
    });
  }
  await update("subscriptions", sub.id, { status: "ACTIVE", current_period_start: iso(start), current_period_end: iso(end), autopay_status: "ACTIVE", autopay_next_charge_at: end, cancel_at_period_end: 0 });
  await resetPlanCredits(sub.tenant_id, plan.ai_credits_month, { rollover: plan.credit_rollover === 1 });
  await markInvoicePaid({ invoiceId: inv.id, gateway: "RAZORPAY", gatewayPaymentId: payment.id, gatewayOrderId: payment.order_id || null, raw: payment, actor: "autopay" });
  return { renewed: true, periodEnd: iso(end) };
}

/** Webhook events for subscriptions. Returns null when the event isn't a subscription event. */
export async function handleSubscriptionWebhook(event) {
  const type = String(event?.event || "");
  if (!type.startsWith("subscription.")) return null;
  const entity = event?.payload?.subscription?.entity;
  if (!entity?.id) return { ignored: "no subscription" };
  const sub = await one("SELECT * FROM subscriptions WHERE rzp_subscription_id=?", [entity.id]);
  if (!sub) return { ignored: "unknown subscription" };
  const next = entity.charge_at ? new Date(entity.charge_at * 1000) : null;
  switch (type) {
    case "subscription.authenticated":
      await update("subscriptions", sub.id, { autopay_status: "AUTHENTICATED", autopay_next_charge_at: next });
      return { ok: true };
    case "subscription.activated":
      await update("subscriptions", sub.id, { autopay_status: "ACTIVE", autopay_next_charge_at: next });
      return { ok: true };
    case "subscription.charged": {
      const payment = event?.payload?.payment?.entity;
      if (!payment?.id) return { ignored: "no payment" };
      return charged(sub, payment);
    }
    case "subscription.pending":
    case "subscription.halted":
      await update("subscriptions", sub.id, { autopay_status: type === "subscription.halted" ? "HALTED" : "PENDING", status: "PAST_DUE" });
      return { ok: true };
    case "subscription.cancelled":
    case "subscription.completed":
      await update("subscriptions", sub.id, { autopay_status: type === "subscription.completed" ? "COMPLETED" : "CANCELLED", autopay_next_charge_at: null });
      return { ok: true };
    default:
      return { ignored: type };
  }
}
