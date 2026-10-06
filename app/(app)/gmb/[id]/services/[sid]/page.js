import { notFound } from "next/navigation";
import { requireTenantContext } from "@/lib/saas/context.js";
import { one } from "@/lib/db";
import { ServiceFormPage } from "@/components/gmb/service-form-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit service" };

export default async function Page({ params }) {
  const ctx = await requireTenantContext();
  const { id, sid } = await params;
  if (!/^\d+$/.test(String(sid))) notFound();
  const c = await one("SELECT id, business_name FROM clients WHERE id=? AND tenant_id=?", [Number(id), ctx.tenantId]);
  if (!c) notFound();
  return <ServiceFormPage clientId={c.id} index={String(sid)} business={c.business_name} />;
}
