import { query } from "@/lib/db";
import { SubscriptionList } from "@/components/admin/subscription-list";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const subscriptions = await query(
    `SELECT s.*, t.name AS tenant_name, t.status AS tenant_status, p.name AS plan_name
       FROM subscriptions s
       JOIN tenants t ON t.id=s.tenant_id
       JOIN plans p ON p.id=s.plan_id
      ORDER BY s.id DESC`
  );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Subscriptions</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Renewals, trials and expiries across every tenant.</p>
      </div>
      <SubscriptionList subscriptions={JSON.parse(JSON.stringify(subscriptions))} />
    </div>
  );
}
