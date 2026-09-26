import { requireTenantContext } from "@/lib/saas/context.js";
import { query } from "@/lib/db";
import { ReviewInbox } from "@/components/review-inbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review inbox" };

export default async function ReviewsPage({ searchParams }) {
  const ctx = await requireTenantContext();
  const sp = await searchParams;
  const clients = await query("SELECT id, business_name FROM clients WHERE tenant_id=? AND active=1 ORDER BY business_name", [ctx.tenantId]);
  return <ReviewInbox clients={JSON.parse(JSON.stringify(clients))} initialClient={sp?.client || ""} initialStatus={sp?.status || "UNREPLIED"} />;
}
