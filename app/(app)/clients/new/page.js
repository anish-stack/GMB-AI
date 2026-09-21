import { ClientForm } from "@/components/client-form";
import { listEmployeesForAssignment } from "@/lib/repo/employees.js";
import { requireTenantContext } from "@/lib/saas/context.js";
import { QuotaNotice } from "@/components/quota-notice";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const ctx = await requireTenantContext();
  const employees = await listEmployeesForAssignment(ctx.tenantId);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">New client</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">A mock GMB profile is created automatically.</p>
      </div>
      <QuotaNotice
        used={ctx.ent.live.clients}
        limit={ctx.limits.max_clients}
        label="clients"
        planName={ctx.plan?.name}
      />
      <ClientForm employees={employees} />
    </div>
  );
}
