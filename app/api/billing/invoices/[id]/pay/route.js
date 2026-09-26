import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { createInvoiceOrder, verifyInvoicePayment } from "@/lib/payments/invoicePayments.js";

export const dynamic = "force-dynamic";

/** POST {} -> Razorpay order.  POST { razorpay_order_id, razorpay_payment_id, razorpay_signature } -> verify + mark paid. */
export async function POST(request, { params }) {
  const g = await guard(request, { permission: "billing.manage" });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.razorpay_payment_id) {
      const inv = await verifyInvoicePayment(Number(id), g.ctx, body);
      return NextResponse.json({ ok: true, invoice: inv, message: `Payment received for ${inv.invoice_no}.` });
    }
    return NextResponse.json({ ok: true, ...(await createInvoiceOrder(Number(id), g.ctx)) });
  } catch (err) {
    return apiError(err);
  }
}
