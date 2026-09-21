import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { changePlan, cancelSubscription, validateCoupon, getPlan } from "@/lib/saas/billing.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

/** body.action: change-plan | cancel | preview-coupon */
export async function POST(request) {
  const g = await guard(request, { permission: "billing.manage" });
  if (g.error) return g.error;
  const { ctx } = g;

  try {
    const body = await request.json();

    if (body.action === "preview-coupon") {
      const plan = await getPlan(Number(body.plan_id));
      const price = body.billing_cycle === "YEARLY" ? plan.price_yearly : plan.price_monthly;
      const c = await validateCoupon(body.coupon_code, Number(price));
      return NextResponse.json({ ok: true, amountOff: c.amountOff, code: c.code });
    }

    if (body.action === "cancel") {
      await cancelSubscription({
        tenantId: ctx.tenantId,
        immediate: false,
        actor: ctx.name,
        reason: body.reason || "Cancelled by customer",
      });
      await audit(ctx, "SUBSCRIPTION_CANCELLED", { entity: "tenant", entityId: ctx.tenantId });
      return NextResponse.json({ ok: true, message: "Your plan will end at the close of the current period." });
    }

    if (!body.plan_id) return NextResponse.json({ error: "plan_id is required" }, { status: 400 });
    const result = await changePlan({
      tenantId: ctx.tenantId,
      planId: Number(body.plan_id),
      billingCycle: body.billing_cycle === "YEARLY" ? "YEARLY" : "MONTHLY",
      actor: ctx.name,
      note: "Changed by customer",
    });
    await audit(ctx, "SUBSCRIPTION_CHANGED", { entity: "tenant", entityId: ctx.tenantId, meta: { plan: body.plan_id } });
    return NextResponse.json({
      ok: true,
      invoice: result.invoice,
      message: result.invoice
        ? `Invoice ${result.invoice.invoice_no} raised. Complete the payment to keep the plan active.`
        : "Plan updated.",
    });
  } catch (err) {
    return apiError(err);
  }
}
