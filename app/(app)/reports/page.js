import { requireTenantContext } from "@/lib/saas/context.js";
import { query } from "@/lib/db";
import { ReportHistory } from "@/components/report-history";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shared reports" };

export default async function ReportsPage() {
  const ctx = await requireTenantContext();
  const clients = await query("SELECT id, business_name FROM clients WHERE tenant_id=? ORDER BY business_name", [ctx.tenantId]);
  return <ReportHistory clients={JSON.parse(JSON.stringify(clients))} />;
}
