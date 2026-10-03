import { notFound } from "next/navigation";
import { requireTenantContext } from "@/lib/saas/context.js";
import { one } from "@/lib/db";
import { CreateWebsitePage } from "@/components/gmb/website-create";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create website from Google" };

/** Full page (not a modal): theme -> web address -> images -> create & fill from GMB data. */
export default async function Page({ params }) {
  const ctx = await requireTenantContext();
  const { id } = await params;
  const client = await one("SELECT id, business_name, business_category, city FROM clients WHERE id=? AND tenant_id=?", [Number(id), ctx.tenantId]);
  if (!client) notFound();
  return <CreateWebsitePage clientId={client.id} business={client.business_name} subtitle={[client.business_category, client.city].filter(Boolean).join(" · ")} />;
}
