import { listTenants } from "@/lib/saas/tenants.js";
import { listPlans } from "@/lib/saas/billing.js";
import { TenantList } from "@/components/admin/tenant-list";

export const dynamic = "force-dynamic";

export default async function AdminTenantsPage() {
  const [tenants, plans] = await Promise.all([listTenants(), listPlans({ activeOnly: true })]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Tenants</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Create accounts, switch plans, grant credits, suspend or impersonate.</p>
      </div>
      <TenantList tenants={JSON.parse(JSON.stringify(tenants))} plans={JSON.parse(JSON.stringify(plans))} />
    </div>
  );
}
