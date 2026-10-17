import { requirePagePermission } from "@/lib/saas/context.js";
import { notFound } from "next/navigation";
import { requireTenantContext } from "@/lib/saas/context.js";
import { one } from "@/lib/db";
import { ServiceFormPage } from "@/components/gmb/service-form-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add service" };

export default async function Page({ params, searchParams }) {
  await requirePagePermission("gmb.edit");
  const ctx = await requireTenantContext();
  const { id } = await params;
  const sp = await searchParams;
  const c = await one("SELECT id, business_name FROM clients WHERE id=? AND tenant_id=?", [Number(id), ctx.tenantId]);
  if (!c) notFound();
  return <ServiceFormPage clientId={c.id} index="new" presetCategory={sp?.category || null} business={c.business_name} />;
}
