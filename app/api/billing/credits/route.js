import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { purchaseCreditPack } from "@/lib/saas/billing.js";
import { getSettings } from "@/lib/saas/settings.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const g = await guard(request, { permission: "billing.manage" });
  if (g.error) return g.error;
  const { ctx } = g;
  try {
    const body = await request.json();
    if (!body.pack_id) return NextResponse.json({ error: "pack_id is required" }, { status: 400 });

    const settings = await getSettings();
    // Manual mode: credits are added immediately and the invoice is marked PAID.
    // With a live gateway wired in, set autoApprove=false and credit on webhook.
    const autoApprove = Number(settings.razorpay_enabled) !== 1;

    const result = await purchaseCreditPack({
      tenantId: ctx.tenantId,
      packId: Number(body.pack_id),
      autoApprove,
      actor: ctx.name,
    });
    await audit(ctx, "CREDITS_PURCHASED", { entity: "invoice", entityId: result.invoice.id, meta: { credits: result.credits } });

    return NextResponse.json({
      ok: true,
      invoice: result.invoice,
      credits: autoApprove ? result.credits : 0,
      message: autoApprove
        ? `${result.credits} credits added to your wallet.`
        : `Invoice ${result.invoice.invoice_no} raised. Credits are released once payment is confirmed.`,
    });
  } catch (err) {
    return apiError(err);
  }
}
