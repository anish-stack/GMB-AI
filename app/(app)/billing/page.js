import { requireTenantContext } from "@/lib/saas/context.js";
import { BillingClient } from "@/components/billing-client";
import { listPlans, listCreditPacks, listInvoices, getSubscription } from "@/lib/saas/billing.js";
import { quotaSummary } from "@/lib/saas/entitlements.js";
import { listLedger, estimatePostCost } from "@/lib/saas/credits.js";
import { razorpayConfig } from "@/lib/payments/razorpay.js";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const ctx = await requireTenantContext();

  const [plans, packs, invoices, ledger, subscription, postCost, rp] = await Promise.all([
    listPlans({ publicOnly: true }),
    listCreditPacks(),
    listInvoices({ tenantId: ctx.tenantId, limit: 25 }),
    listLedger(ctx.tenantId, 40),
    getSubscription(ctx.tenantId),
    estimatePostCost({ withImage: ctx.features.f_image_generation }),
    razorpayConfig(),
  ]);

  const data = {
    subscription,
    plan: ctx.plan,
    limits: ctx.limits,
    features: ctx.features,
    usage: ctx.ent.usage,
    live: ctx.ent.live,
    wallet: ctx.ent.wallet,
    quotas: quotaSummary(ctx.ent),
    status: ctx.ent.status,
    plans,
    packs,
    invoices,
    ledger,
    postCost,
    onlinePayments: rp.enabled,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Billing & plan</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your subscription, usage against plan limits, AI credit wallet and invoices.
        </p>
      </div>
      <BillingClient data={JSON.parse(JSON.stringify(data))} canManage={ctx.can("billing.manage")} />
    </div>
  );
}
