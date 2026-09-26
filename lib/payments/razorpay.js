import "server-only";
import crypto from "node:crypto";
import { getSettings } from "../saas/settings.js";

const API = "https://api.razorpay.com/v1";

/** Keys: Admin -> Integrations (encrypted) first, then legacy platform settings, then .env. */
export async function razorpayConfig() {
  const s = await getSettings();
  const { getIntegration } = await import("../integrations/store.js");
  const rp = await getIntegration("razorpay").catch(() => null);
  const v = rp?.values || {};
  const keyId = v.key_id || s.razorpay_key_id || process.env.RAZORPAY_KEY_ID || "";
  const keySecret = v.key_secret || s.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET || "";
  const webhookSecret = v.webhook_secret || s.razorpay_webhook_secret || process.env.RAZORPAY_WEBHOOK_SECRET || "";
  const switchedOn = rp?.row ? Boolean(rp.row.enabled) : Number(s.razorpay_enabled) === 1;
  const enabled = switchedOn && Boolean(keyId && keySecret);
  return { enabled, keyId, keySecret, webhookSecret, brand: s.platform_name || "GMB AI Cloud", testMode: keyId.startsWith("rzp_test_") };
}

async function call(cfg, path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(`Payment gateway error: ${json?.error?.description || res.status}`);
    e.status = 502;
    throw e;
  }
  return json;
}

export const toPaise = (amount) => Math.round(Number(amount || 0) * 100);

/** Creates a Razorpay order. `notes` is how we tie the payment back to a signup / invoice. */
export async function createOrder({ amount, currency = "INR", receipt, notes = {} }) {
  const cfg = await razorpayConfig();
  if (!cfg.enabled) {
    const e = new Error("Online payments are not enabled.");
    e.status = 400;
    throw e;
  }
  const order = await call(cfg, "/orders", {
    method: "POST",
    body: { amount: toPaise(amount), currency, receipt: String(receipt).slice(0, 40), notes, payment_capture: 1 },
  });
  return { order, keyId: cfg.keyId, brand: cfg.brand, testMode: cfg.testMode };
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Full server-side confirmation of a checkout callback:
 * 1. HMAC signature (order_id|payment_id) with the key secret
 * 2. Payment fetched from Razorpay: belongs to the order, right amount
 * 3. Captured (captures it if the account uses manual capture)
 */
export async function confirmCheckout({ orderId, paymentId, signature, expectedAmount, currency = "INR" }) {
  const cfg = await razorpayConfig();
  if (!cfg.keySecret) throw Object.assign(new Error("Payment gateway not configured."), { status: 400 });

  const expected = crypto.createHmac("sha256", cfg.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  if (!safeEqual(expected, signature)) throw Object.assign(new Error("Payment signature mismatch."), { status: 400 });

  let payment = await call(cfg, `/payments/${encodeURIComponent(paymentId)}`);
  if (payment.order_id !== orderId) throw Object.assign(new Error("Payment does not belong to this order."), { status: 400 });
  if (expectedAmount != null && Number(payment.amount) !== toPaise(expectedAmount)) {
    throw Object.assign(new Error("Paid amount does not match."), { status: 400 });
  }
  if (payment.status === "authorized") {
    payment = await call(cfg, `/payments/${encodeURIComponent(paymentId)}/capture`, {
      method: "POST",
      body: { amount: payment.amount, currency: payment.currency || currency },
    });
  }
  if (payment.status !== "captured") throw Object.assign(new Error(`Payment is ${payment.status}.`), { status: 402 });
  return payment;
}

export async function fetchOrder(orderId) {
  const cfg = await razorpayConfig();
  return call(cfg, `/orders/${encodeURIComponent(orderId)}`);
}

export async function verifyWebhook(rawBody, signature) {
  const cfg = await razorpayConfig();
  if (!cfg.webhookSecret) return false;
  const expected = crypto.createHmac("sha256", cfg.webhookSecret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}
