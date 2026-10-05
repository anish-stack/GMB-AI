import { notFound } from "next/navigation";
import { requireTenantContext } from "@/lib/saas/context.js";
import { one } from "@/lib/db";
import { WebsiteEditor } from "@/components/gmb/website-editor/editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website editor" };

/** Native website editor (no iframe): /gmb/:id/website/:websiteId */
export default async function Page({ params }) {
  const ctx = await requireTenantContext();
  const { id, wid } = await params;
  if (!/^[a-f0-9]{24}$/.test(String(wid))) notFound();
  const client = await one("SELECT id, business_name FROM clients WHERE id=? AND tenant_id=?", [Number(id), ctx.tenantId]);
  if (!client) notFound();
  return <WebsiteEditor clientId={client.id} wid={wid} business={client.business_name} />;
}
