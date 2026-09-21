import { query } from "@/lib/db";
import { listCreditPacks } from "@/lib/saas/billing.js";
import { creditCosts } from "@/lib/saas/settings.js";
import { CreditManager } from "@/components/admin/credit-manager";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage() {
  const [wallets, packs, tenants, costs] = await Promise.all([
    query(`SELECT w.*, t.name AS tenant_name FROM credit_wallets w JOIN tenants t ON t.id=w.tenant_id ORDER BY w.lifetime_used DESC`),
    listCreditPacks({ activeOnly: false }),
    query("SELECT id, name FROM tenants ORDER BY name"),
    creditCosts(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI credits</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Every AI agent call debits the tenant wallet. Plan credits refill each cycle, purchased credits never expire.
        </p>
      </div>
      <CreditManager
        wallets={JSON.parse(JSON.stringify(wallets))}
        packs={JSON.parse(JSON.stringify(packs))}
        tenants={JSON.parse(JSON.stringify(tenants))}
        costs={costs}
      />
    </div>
  );
}
