import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { listCoupons, saveCoupon } from "@/lib/saas/billing.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  return NextResponse.json({ coupons: await listCoupons() });
}

export async function POST(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  try {
    const body = await request.json();
    if (!body.code) return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    const id = await saveCoupon(body);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return apiError(err);
  }
}
