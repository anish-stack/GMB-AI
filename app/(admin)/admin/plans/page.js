import { listPlans } from "@/lib/saas/billing.js";
import { PlanManager } from "@/components/admin/plan-manager";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const plans = await listPlans({ activeOnly: false });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Plans & packaging</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Price, quotas and feature flags. Everything here is enforced live for every tenant on the plan.
        </p>
      </div>
      <PlanManager plans={JSON.parse(JSON.stringify(plans))} />
    </div>
  );
}
