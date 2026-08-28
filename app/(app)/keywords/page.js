import Link from "next/link";
import { query } from "@/lib/db";
import { Card, CardHeader, Table, EmptyRow, Badge, Stat } from "@/components/ui";
import { truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function KeywordsPage({ searchParams }) {
  const sp = await searchParams;
  const clientId = sp?.client ? Number(sp.client) : null;

  const rows = await query(
    `SELECT k.*, c.business_name, c.city FROM keywords k JOIN clients c ON c.id=k.client_id
      ${clientId ? "WHERE k.client_id=?" : ""}
      ORDER BY c.business_name, k.relevance_score DESC LIMIT 500`,
    clientId ? [clientId] : []
  );
  const [counts] = await query(
    `SELECT COUNT(*) total, SUM(source='AI_SUGGESTED') ai, SUM(source='CLIENT') client,
            SUM(has_volume_data=1) with_volume FROM keywords`
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Keywords</h1>
        <p className="text-sm text-slate-500">
          No search-volume provider is connected, so every AI keyword is labelled AI suggested.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total keywords" value={counts.total} tone="indigo" />
        <Stat label="From clients" value={counts.client || 0} tone="emerald" />
        <Stat label="AI suggested" value={counts.ai || 0} tone="blue" />
        <Stat label="With real volume data" value={counts.with_volume || 0} sub="Needs a keyword data source" tone="amber" />
      </div>

      <Card>
        <CardHeader title={`${rows.length} keywords`} subtitle={clientId ? "Filtered by client" : "All clients"} />
        <Table head={["Keyword", "Client", "Type", "Source", "Relevance", "Priority", "Reason"]}
          empty={!rows.length ? <EmptyRow colSpan={7}>No keywords yet.</EmptyRow> : null}>
          {rows.map((k) => (
            <tr key={k.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 text-slate-800">{k.keyword}</td>
              <td className="px-4 py-2">
                <Link href={`/clients/${k.client_id}`} className="text-slate-600 hover:text-indigo-600">{k.business_name}</Link>
              </td>
              <td className="px-4 py-2"><Badge>{k.kw_type}</Badge></td>
              <td className="px-4 py-2">
                <Badge tone={k.source === "CLIENT" ? "emerald" : "blue"}>{k.source === "CLIENT" ? "Client" : "AI suggested"}</Badge>
              </td>
              <td className="px-4 py-2 text-slate-600">{k.relevance_score}</td>
              <td className="px-4 py-2 text-slate-600">{k.priority}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{truncate(k.reason, 80)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
