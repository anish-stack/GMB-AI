import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { listInvoices, createInvoice } from "@/lib/saas/billing.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    invoices: await listInvoices({
      tenantId: searchParams.get("tenantId") ? Number(searchParams.get("tenantId")) : null,
      status: searchParams.get("status") || null,
    }),
  });
}

export async function POST(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  try {
    const body = await request.json();
    if (!body.tenant_id || !Array.isArray(body.items) || !body.items.length) {
      return NextResponse.json({ error: "tenant_id and at least one item are required" }, { status: 400 });
    }
    const invoice = await createInvoice({
      tenantId: Number(body.tenant_id),
      type: "MANUAL",
      items: body.items.map((i) => ({
        label: i.label,
        qty: Number(i.qty || 1),
        unit_price: Number(i.unit_price || 0),
        amount: Number(i.qty || 1) * Number(i.unit_price || 0),
      })),
      couponCode: body.coupon_code || null,
      notes: body.notes || null,
    });
    return NextResponse.json({ ok: true, invoice });
  } catch (err) {
    return apiError(err);
  }
}
