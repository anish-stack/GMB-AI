import { query } from "@/lib/db";
import { requireTenantContext } from "@/lib/saas/context.js";
import { gmbProviderInfo } from "@/lib/gmb/provider.js";
import { GmbProfilesTable } from "@/components/gmb-profiles-table";

export const dynamic = "force-dynamic";

export default async function GmbListPage() {
  const ctx = await requireTenantContext();
  const rows = await query(
    `SELECT p.*, c.business_name, c.city, c.gmb_location_id,
            (SELECT COUNT(*) FROM gmb_posts g WHERE g.client_id=c.id) AS posts
       FROM gmb_profiles p JOIN clients c ON c.id=p.client_id
      WHERE c.tenant_id=?
      ORDER BY c.business_name`,
    [ctx.tenantId]
  );
  const provider = gmbProviderInfo();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">GMB profiles</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Provider: {provider.name}{provider.isMock ? " - mock data, nothing is read from or written to Google." : ""}
        </p>
      </div>

      <GmbProfilesTable rows={JSON.parse(JSON.stringify(rows))} />
    </div>
  );
}
