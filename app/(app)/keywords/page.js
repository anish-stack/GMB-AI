import { query } from "@/lib/db";
import { requireTenantContext } from "@/lib/saas/context.js";
import { Stat } from "@/components/ui";
import { KeywordsTable } from "@/components/keywords-table";

export const dynamic = "force-dynamic";

export default async function KeywordsPage({ searchParams }) {
  const ctx = await requireTenantContext();
  const sp = await searchParams;
  const clientId = sp?.client ? Number(sp.client) : null;

  const rows = await query(
    `SELECT k.*, c.business_name, c.city FROM keywords k JOIN clients c ON c.id=k.client_id
      WHERE k.tenant_id=?${clientId ? " AND k.client_id=?" : ""}
      ORDER BY c.business_name, k.relevance_score DESC LIMIT 500`,
    clientId ? [ctx.tenantId, clientId] : [ctx.tenantId]
  );
  const [counts] = await query(
    `SELECT COUNT(*) total, SUM(source='AI_SUGGESTED') ai, SUM(source='CLIENT') client,
            SUM(has_volume_data=1) with_volume FROM keywords WHERE tenant_id=?`,
    [ctx.tenantId]
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Keywords</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No search-volume provider is connected, so every AI keyword is labelled AI suggested.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total keywords" value={counts.total} tone="indigo" />
        <Stat label="From clients" value={counts.client || 0} tone="emerald" />
        <Stat label="AI suggested" value={counts.ai || 0} tone="blue" />
        <Stat label="With real volume data" value={counts.with_volume || 0} sub="Needs a keyword data source" tone="amber" />
      </div>

      <KeywordsTable rows={JSON.parse(JSON.stringify(rows))} clientFiltered={!!clientId} />
    </div>
  );
}
