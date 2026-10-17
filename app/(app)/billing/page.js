import { requirePagePermission } from "@/lib/saas/context.js";
import { AutopayCard } from "@/components/autopay-card";
import { requireTenantContext } from "@/lib/saas/context.js";
import { BillingClient } from "@/components/billing-client";
import { listPlans, listCreditPacks, listInvoices, getSubscription } from "@/lib/saas/billing.js";
import { quotaSummary } from "@/lib/saas/entitlements.js";
import { listLedger, estimatePostCost } from "@/lib/saas/credits.js";
import { razorpayConfig } from "@/lib/payments/razorpay.js";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  await requirePagePermission("billing.view");
  const ctx = await requireTenantContext();

  if (ctx.ent.internal) {
    // own-company account: nothing to pay, nothing to limit
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Billing & plan</h1>
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-zinc-900">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Own company account</p>
          <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{ctx.tenant.name}</p>
          <ul className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2 dark:text-zinc-200">
            {["Unlimited AI credits", "Unlimited clients & GMB profiles", "Unlimited team members", "Every feature unlocked", "No plan expiry", "No payments or invoices"].map((t) => (
              <li key={t} className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] text-white">✓</span>{t}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-zinc-500">AI usage is still counted (lifetime: {Number(ctx.ent.wallet.lifetime_used || 0).toLocaleString("en-IN")} credits) so you can see how much the team uses.</p>
        </div>
      </div>
    );
  }

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
      <AutopayCard canManage={ctx.can("billing.manage")} />
      <BillingClient data={JSON.parse(JSON.stringify(data))} canManage={ctx.can("billing.manage")} />
    </div>
  );
}
