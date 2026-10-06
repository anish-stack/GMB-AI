import { notFound } from "next/navigation";
import { requireTenantContext } from "@/lib/saas/context.js";
import { one } from "@/lib/db";
import { ProductFormPage } from "@/components/gmb/product-form-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add product" };

export default async function Page({ params }) {
  const ctx = await requireTenantContext();
  const { id, pid } = await params;
  if (pid !== undefined && !/^\d+$/.test(String(pid))) notFound();
  const c = await one("SELECT id, business_name FROM clients WHERE id=? AND tenant_id=?", [Number(id), ctx.tenantId]);
  if (!c) notFound();
  return <ProductFormPage clientId={c.id} productId={null} business={c.business_name} />;
}
