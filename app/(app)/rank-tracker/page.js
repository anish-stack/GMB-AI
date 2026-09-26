import { requireTenantContext } from "@/lib/saas/context.js";
import { query } from "@/lib/db";
import { RankTracker } from "@/components/rank-tracker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rank tracker" };

export default async function Page() {
  const ctx = await requireTenantContext();
  const clients = await query("SELECT id, business_name, place_id FROM clients WHERE tenant_id=? AND active=1 ORDER BY business_name", [ctx.tenantId]);
  return <RankTracker clients={JSON.parse(JSON.stringify(clients))} />;
}
