import "server-only";
import { one } from "../db.js";
import { markInvoicePaid } from "../saas/billing.js";
import { createOrder, confirmCheckout, fetchOrder } from "./razorpay.js";

const fail = (m, status = 400) => Object.assign(new Error(m), { status });

async function dueInvoice(invoiceId, tenantId) {
  const inv = await one("SELECT * FROM invoices WHERE id=? AND tenant_id=?", [invoiceId, tenantId]);
  if (!inv) throw fail("Invoice not found.", 404);
  if (inv.status === "PAID") throw fail("This invoice is already paid.", 409);
  if (inv.status !== "DUE") throw fail(`Invoice is ${inv.status}.`);
  return inv;
}

/** Razorpay order for an existing DUE invoice (billing page "Pay now"). */
export async function createInvoiceOrder(invoiceId, ctx) {
  const inv = await dueInvoice(invoiceId, ctx.tenantId);
  const { order, keyId, brand, testMode } = await createOrder({
    amount: inv.total,
    currency: inv.currency,
    receipt: inv.invoice_no,
    notes: { kind: "invoice", invoice_id: String(inv.id), tenant_id: String(inv.tenant_id) },
  });
  return {
    keyId,
    testMode,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    name: brand,
    description: `Invoice ${inv.invoice_no}`,
    prefill: { name: ctx.session?.name || "", email: ctx.session?.email || "" },
  };
}

export async function verifyInvoicePayment(invoiceId, ctx, body) {
  const inv = await dueInvoice(invoiceId, ctx.tenantId);
  const order = await fetchOrder(body.razorpay_order_id);
  if (String(order.notes?.invoice_id) !== String(inv.id)) throw fail("Order does not belong to this invoice.");
  const payment = await confirmCheckout({
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
    expectedAmount: inv.total,
    currency: inv.currency,
  });
  return markInvoicePaid({
    invoiceId: inv.id,
    gateway: "RAZORPAY",
    gatewayPaymentId: payment.id,
    gatewayOrderId: payment.order_id,
    raw: payment,
    actor: ctx.session?.name || "tenant",
  });
}

export async function settleInvoiceFromWebhook(orderId, payment) {
  const order = await fetchOrder(orderId);
  const inv = await one("SELECT * FROM invoices WHERE id=?", [Number(order.notes?.invoice_id)]);
  if (!inv || inv.status === "PAID") return null;
  if (Number(payment.amount) !== Math.round(Number(inv.total) * 100)) return null;
  return markInvoicePaid({ invoiceId: inv.id, gateway: "RAZORPAY", gatewayPaymentId: payment.id, gatewayOrderId: orderId, raw: payment, actor: "razorpay-webhook" });
}
