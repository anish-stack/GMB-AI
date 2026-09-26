import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { one, insert, update, query } from "../db.js";
import { getSettings } from "./settings.js";
import { provisionTenant } from "./tenants.js";
import { markInvoicePaid } from "./billing.js";
import { queueEmail } from "../mail/queue.js";
import { otpEmail } from "../mail/templates.js";
import { razorpayConfig, createOrder, confirmCheckout } from "../payments/razorpay.js";

const OTP_MIN = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const INTENT_TTL_MS = 2 * 60 * 60 * 1000; // a signup must finish within 2 hours
const MAX_ATTEMPTS = 5;

const secret = () => process.env.SESSION_SECRET || "dev-insecure-secret";
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

/* ---------- signed intent token (id + expiry), so ids can't be guessed ---------- */
function sign(id) {
  const body = Buffer.from(JSON.stringify({ id, exp: Date.now() + INTENT_TTL_MS })).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(`signup:${body}`).digest("base64url");
  return `${body}.${mac}`;
}

function unsign(token) {
  const [body, mac] = String(token || "").split(".");
  if (!body || !mac) throw fail("Signup session expired. Please start again.", 410);
  const expected = crypto.createHmac("sha256", secret()).update(`signup:${body}`).digest("base64url");
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
    throw fail("Signup session expired. Please start again.", 410);
  }
  const data = JSON.parse(Buffer.from(body, "base64url").toString());
  if (!data.exp || data.exp < Date.now()) throw fail("Signup session expired. Please start again.", 410);
  return data.id;
}

async function loadIntent(token) {
  const intent = await one("SELECT * FROM signup_intents WHERE id=?", [unsign(token)]);
  if (!intent) throw fail("Signup session not found. Please start again.", 410);
  return intent;
}

const hashCode = (id, code) => crypto.createHmac("sha256", secret()).update(`signup-otp:${id}:${code}`).digest("hex");

/** Same maths as createInvoice(): price + tax. */
export async function quotePlan(plan, cycle) {
  const settings = await getSettings();
  const subtotal = Number(cycle === "YEARLY" ? plan.price_yearly : plan.price_monthly) || 0;
  const taxPercent = Number(settings.tax_percent || 0);
  const tax = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const trial = subtotal > 0 && Number(plan.trial_days) > 0;
  const rp = await razorpayConfig();
  return {
    subtotal,
    tax,
    taxPercent,
    total,
    currency: plan.currency || settings.currency || "INR",
    trialDays: trial ? Number(plan.trial_days) : 0,
    requiresPayment: total > 0 && !trial && rp.enabled,
    payLater: total > 0 && !trial && !rp.enabled,
  };
}

function publicIntent(intent, quote, plan) {
  const [u, d] = intent.email.split("@");
  return {
    token: sign(intent.id),
    email: intent.email,
    maskedEmail: `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`,
    verified: Boolean(intent.email_verified_at),
    plan: { name: plan.name, slug: plan.slug, cycle: intent.billing_cycle },
    quote,
  };
}

async function sendCode(intent) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await update("signup_intents", intent.id, {
    code_hash: hashCode(intent.id, code),
    attempts: 0,
    code_expires_at: new Date(Date.now() + OTP_MIN * 60000),
  });
  const tpl = otpEmail({ name: intent.owner_name, code, minutes: OTP_MIN, purpose: "SIGNUP" });
  await queueEmail({ to: intent.email, subject: tpl.subject, html: tpl.html, text: tpl.text, template: "otp" });
}

/** Step 1: validate details, store a pending signup, email a 6-digit code. */
export async function startSignup(input, { ip = null } = {}) {
  const email = String(input.email || "").trim().toLowerCase();
  const company = String(input.company_name || "").trim();
  const name = String(input.name || "").trim();
  const password = String(input.password || "");
  const phone = String(input.phone || "").replace(/[^\d+]/g, "").slice(0, 20) || null;

  if (!company || !name) throw fail("Company and your name are required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw fail("Enter a valid email address.");
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw fail("Password needs at least 8 characters with letters and numbers.");
  }
  if (phone && phone.replace(/\D/g, "").length < 10) throw fail("Enter a valid phone number.");
  if (await one("SELECT id FROM users WHERE email=?", [email])) {
    throw fail("An account with this email already exists. Sign in instead.", 409);
  }

  const settings = await getSettings();
  const plan =
    (await one("SELECT * FROM plans WHERE slug=? AND is_active=1 AND is_public=1", [input.plan_slug])) ||
    (await one("SELECT * FROM plans WHERE slug=? AND is_active=1", [settings.default_plan_slug || "free"]));
  if (!plan) throw fail("Selected plan is not available.");
  const cycle = input.billing_cycle === "YEARLY" ? "YEARLY" : "MONTHLY";
  const quote = await quotePlan(plan, cycle);

  const id = await insert("signup_intents", {
    email,
    company_name: company.slice(0, 180),
    owner_name: name.slice(0, 120),
    phone,
    password_hash: await bcrypt.hash(password, 10),
    plan_id: plan.id,
    billing_cycle: cycle,
    amount: quote.requiresPayment ? quote.total : 0,
    currency: quote.currency,
    status: "PENDING_OTP",
    ip,
  });
  const intent = await one("SELECT * FROM signup_intents WHERE id=?", [id]);
  await sendCode(intent);
  return publicIntent(intent, quote, plan);
}

export async function resendSignupCode(token) {
  const intent = await loadIntent(token);
  if (intent.email_verified_at) throw fail("Email already verified.");
  await sendCode(intent);
  return { ok: true };
}

/** Step 2: verify the email code. Free/trial/pay-later plans are provisioned right here. */
export async function verifySignupEmail(token, code) {
  const intent = await loadIntent(token);
  const plan = await one("SELECT * FROM plans WHERE id=?", [intent.plan_id]);
  if (!intent.email_verified_at) {
    if (intent.attempts >= MAX_ATTEMPTS) throw fail("Too many wrong codes. Request a new code.", 429);
    if (!intent.code_expires_at || new Date(intent.code_expires_at).getTime() < Date.now()) {
      throw fail("This code has expired. Request a new one.");
    }
    const clean = String(code || "").replace(/\D/g, "");
    if (hashCode(intent.id, clean) !== intent.code_hash) {
      await query("UPDATE signup_intents SET attempts=attempts+1 WHERE id=?", [intent.id]);
      const left = MAX_ATTEMPTS - intent.attempts - 1;
      throw fail(left > 0 ? `Incorrect code. ${left} attempt(s) left.` : "Incorrect code. Request a new one.");
    }
    await update("signup_intents", intent.id, { email_verified_at: new Date(), code_hash: null, status: "VERIFIED" });
    intent.email_verified_at = new Date();
  }

  const quote = await quotePlan(plan, intent.billing_cycle);
  if (quote.requiresPayment) {
    await update("signup_intents", intent.id, { amount: quote.total });
    return { next: "payment", ...publicIntent({ ...intent, amount: quote.total }, quote, plan) };
  }
  const done = await finalize(intent.id, {});
  return { next: "done", userId: done.userId, trialDays: quote.trialDays, payLater: quote.payLater };
}

/** Step 3a: Razorpay order for the verified signup. */
export async function createSignupOrder(token) {
  const intent = await loadIntent(token);
  if (!intent.email_verified_at) throw fail("Verify your email first.");
  if (intent.status === "COMPLETED") throw fail("This signup is already complete. Please sign in.", 409);
  const plan = await one("SELECT * FROM plans WHERE id=?", [intent.plan_id]);
  const quote = await quotePlan(plan, intent.billing_cycle);
  if (!quote.requiresPayment) throw fail("No payment needed for this plan.");

  const { order, keyId, brand, testMode } = await createOrder({
    amount: quote.total,
    currency: quote.currency,
    receipt: `signup_${intent.id}`,
    notes: { kind: "signup", intent_id: String(intent.id), email: intent.email, plan: plan.slug },
  });
  await update("signup_intents", intent.id, { gateway_order_id: order.id, amount: quote.total, status: "PAYMENT_PENDING" });
  return {
    keyId,
    testMode,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    name: brand,
    description: `${plan.name} plan · ${intent.billing_cycle.toLowerCase()}`,
    prefill: { name: intent.owner_name, email: intent.email, contact: intent.phone || "" },
  };
}

/** Step 3b: checkout success callback from the browser. */
export async function completeSignupPayment(token, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const intent = await loadIntent(token);
  if (intent.status === "COMPLETED") {
    const user = await one("SELECT id FROM users WHERE email=?", [intent.email]);
    return { userId: user?.id || null, alreadyDone: true };
  }
  if (!intent.gateway_order_id || intent.gateway_order_id !== razorpay_order_id) throw fail("Order mismatch.");
  const payment = await confirmCheckout({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
    expectedAmount: intent.amount,
    currency: intent.currency,
  });
  return finalize(intent.id, { paymentId: payment.id, orderId: payment.order_id, raw: payment });
}

/** Webhook path: payment captured but the browser never came back. */
export async function completeSignupFromWebhook(orderId, payment) {
  const intent = await one("SELECT * FROM signup_intents WHERE gateway_order_id=? LIMIT 1", [orderId]);
  if (!intent || intent.status === "COMPLETED") return null;
  if (Number(payment?.amount) !== Math.round(Number(intent.amount) * 100)) return null;
  return finalize(intent.id, { paymentId: payment.id, orderId, raw: payment });
}

/**
 * Creates the workspace exactly once (atomic status flip guards against the
 * browser callback and the webhook racing each other).
 */
async function finalize(intentId, { paymentId = null, orderId = null, raw = null }) {
  const lock = await query(
    "UPDATE signup_intents SET status='PROVISIONING' WHERE id=? AND status IN ('VERIFIED','PAYMENT_PENDING')",
    [intentId],
  );
  const intent = await one("SELECT * FROM signup_intents WHERE id=?", [intentId]);
  if (!lock?.affectedRows) {
    if (intent?.status === "COMPLETED") {
      const user = await one("SELECT id FROM users WHERE email=?", [intent.email]);
      return { userId: user?.id || null, alreadyDone: true };
    }
    throw fail("Signup is already being processed. Please wait a moment and sign in.", 409);
  }
  try {
    const plan = await one("SELECT slug FROM plans WHERE id=?", [intent.plan_id]);
    const { tenantId, userId } = await provisionTenant({
      companyName: intent.company_name,
      ownerName: intent.owner_name,
      email: intent.email,
      passwordHash: intent.password_hash,
      phone: intent.phone,
      planSlug: plan.slug,
      billingCycle: intent.billing_cycle,
    });
    if (paymentId) {
      const inv = await one("SELECT id FROM invoices WHERE tenant_id=? AND status='DUE' ORDER BY id DESC LIMIT 1", [tenantId]);
      if (inv) await markInvoicePaid({ invoiceId: inv.id, gateway: "RAZORPAY", gatewayPaymentId: paymentId, gatewayOrderId: orderId, raw, actor: intent.owner_name });
    }
    await update("signup_intents", intentId, { status: "COMPLETED", tenant_id: tenantId, gateway_payment_id: paymentId, password_hash: "-" });
    return { userId, tenantId };
  } catch (err) {
    await update("signup_intents", intentId, { status: paymentId ? "FAILED" : "VERIFIED" });
    if (paymentId) console.error(`[signup] PAID but provisioning failed intent=${intentId} payment=${paymentId}:`, err.message);
    throw err;
  }
}
