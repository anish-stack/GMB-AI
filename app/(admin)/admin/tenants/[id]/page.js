import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenant } from "@/lib/saas/tenants.js";
import { listPlans } from "@/lib/saas/billing.js";
import { resolveEntitlements } from "@/lib/saas/entitlements.js";
import { TenantDetail } from "@/components/admin/tenant-detail";

export const dynamic = "force-dynamic";

export default async function AdminTenantPage({ params }) {
  const { id } = await params;
  const tenant = await getTenant(Number(id));
  if (!tenant) notFound();
  const [ent, plans] = await Promise.all([resolveEntitlements(Number(id)), listPlans({ activeOnly: true })]);

  return (
    <div className="space-y-5">
      <Link href="/admin/tenants" className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="h-3 w-3" /> All tenants
      </Link>
      <TenantDetail
        tenant={JSON.parse(JSON.stringify(tenant))}
        ent={JSON.parse(JSON.stringify(ent))}
        plans={JSON.parse(JSON.stringify(plans))}
      />
    </div>
  );
}
