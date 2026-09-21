import Link from "next/link";
import { Plus } from "lucide-react";
import { listClients } from "@/lib/repo/clients.js";
import { requireTenantContext } from "@/lib/saas/context.js";
import { Button } from "@/components/ui";
import { ClientsTable } from "@/components/clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const ctx = await requireTenantContext();
  const clients = await listClients(ctx.tenantId);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Clients</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Business data the AI is allowed to use.</p>
        </div>
        <Link href="/clients/new"><Button><Plus className="h-3.5 w-3.5" /> New client</Button></Link>
      </div>

      <ClientsTable clients={JSON.parse(JSON.stringify(clients))} limit={ctx.limits.max_clients} />
    </div>
  );
}
