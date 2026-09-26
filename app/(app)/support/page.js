import { requireTenantContext } from "@/lib/saas/context.js";
import { query } from "@/lib/db";
import { SupportList } from "@/components/support/client-support";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support" };

export default async function SupportPage() {
  const ctx = await requireTenantContext();
  const clients = await query("SELECT id, business_name FROM clients WHERE tenant_id=? ORDER BY business_name", [ctx.tenantId]);
  return <SupportList clients={JSON.parse(JSON.stringify(clients))} />;
}
