import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/payments/razorpay.js";
import { completeSignupFromWebhook } from "@/lib/saas/signup.js";
import { settleInvoiceFromWebhook } from "@/lib/payments/invoicePayments.js";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook - safety net when the customer pays but closes the tab
 * before the browser callback reaches us. Events: payment.captured, order.paid.
 */
export async function POST(request) {
  const raw = await request.text();
  const ok = await verifyWebhook(raw, request.headers.get("x-razorpay-signature"));
  if (!ok) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const event = JSON.parse(raw);
    const payment = event?.payload?.payment?.entity;
    const orderId = payment?.order_id || event?.payload?.order?.entity?.id;
    if (!orderId || !payment || payment.status !== "captured") return NextResponse.json({ ok: true, ignored: true });

    const kind = payment.notes?.kind || event?.payload?.order?.entity?.notes?.kind;
    if (kind === "invoice") await settleInvoiceFromWebhook(orderId, payment);
    else await completeSignupFromWebhook(orderId, payment);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[razorpay webhook]", err.message);
    // 500 makes Razorpay retry later
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
