import { NextResponse } from "next/server";
import { guard } from "@/lib/saas/guard.js";
import { listPlans, listCreditPacks, listInvoices, getSubscription } from "@/lib/saas/billing.js";
import { quotaSummary } from "@/lib/saas/entitlements.js";
import { listLedger, creditUsageByDay, estimatePostCost } from "@/lib/saas/credits.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { permission: "billing.view" });
  if (g.error) return g.error;
  const { ctx } = g;
  if (!ctx.tenantId) return NextResponse.json({ error: "Super admin has no billing account" }, { status: 400 });

  const [plans, packs, invoices, ledger, usageTrend, subscription, postCost] = await Promise.all([
    listPlans({ publicOnly: true }),
    listCreditPacks(),
    listInvoices({ tenantId: ctx.tenantId, limit: 30 }),
    listLedger(ctx.tenantId, 40),
    creditUsageByDay(ctx.tenantId, 14),
    getSubscription(ctx.tenantId),
    estimatePostCost({ withImage: ctx.ent.features.f_image_generation }),
  ]);

  return NextResponse.json({
    subscription,
    plan: ctx.ent.plan,
    limits: ctx.ent.limits,
    features: ctx.ent.features,
    usage: ctx.ent.usage,
    live: ctx.ent.live,
    wallet: ctx.ent.wallet,
    quotas: quotaSummary(ctx.ent),
    daysLeft: ctx.ent.daysLeft,
    status: ctx.ent.status,
    plans,
    packs,
    invoices,
    ledger,
    usageTrend,
    postCost,
  });
}
