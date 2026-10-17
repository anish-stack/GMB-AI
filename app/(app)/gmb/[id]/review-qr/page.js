import { requirePagePermission } from "@/lib/saas/context.js";
import { notFound } from "next/navigation";
import { requireTenantContext } from "@/lib/saas/context.js";
import { one } from "@/lib/db";
import { ReviewStudio } from "@/components/gmb/review-studio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review QR & poster" };

export default async function Page({ params }) {
  await requirePagePermission("gmb.view");
  const ctx = await requireTenantContext();
  const { id } = await params;
  const c = await one("SELECT id, business_name FROM clients WHERE id=? AND tenant_id=?", [Number(id), ctx.tenantId]);
  if (!c) notFound();
  return <ReviewStudio clientId={c.id} business={c.business_name} />;
}
