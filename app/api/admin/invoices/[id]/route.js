import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { getInvoice, markInvoicePaid } from "@/lib/saas/billing.js";
import { update, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;
  const invoice = await getInvoice(Number(id));
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  return NextResponse.json({ invoice });
}

export async function PATCH(request, { params }) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    const body = await request.json();
    if (body.action === "mark-paid") {
      const invoice = await markInvoicePaid({
        invoiceId: Number(id),
        gateway: body.gateway || "MANUAL",
        gatewayPaymentId: body.reference || null,
        actor: g.ctx.name,
      });
      return NextResponse.json({ ok: true, invoice });
    }
    if (body.action === "void") {
      await update("invoices", Number(id), { status: "VOID" });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete") {
      await query("DELETE FROM invoices WHERE id=?", [Number(id)]);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return apiError(err);
  }
}
