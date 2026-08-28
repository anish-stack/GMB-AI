import Link from "next/link";
import { query } from "@/lib/db";
import { gmbProviderInfo } from "@/lib/gmb/provider.js";
import { Card, CardHeader, Table, EmptyRow, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GmbListPage() {
  const rows = await query(
    `SELECT p.*, c.business_name, c.city, c.gmb_location_id,
            (SELECT COUNT(*) FROM gmb_posts g WHERE g.client_id=c.id) AS posts
       FROM gmb_profiles p JOIN clients c ON c.id=p.client_id
      ORDER BY c.business_name`
  );
  const provider = gmbProviderInfo();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">GMB profiles</h1>
        <p className="text-sm text-slate-500">
          Provider: {provider.name}{provider.isMock ? " - mock data, nothing is read from or written to Google." : ""}
        </p>
      </div>

      <Card>
        <CardHeader title={`${rows.length} profiles`} />
        <Table head={["Business", "Category", "Location id", "Rating", "Reviews", "Posts", "Connection", "Synced", ""]}
          empty={!rows.length ? <EmptyRow colSpan={9}>No profiles yet.</EmptyRow> : null}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-medium text-slate-800">{p.business_name}</td>
              <td className="px-4 py-2 text-slate-600">{p.category}</td>
              <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.gmb_location_id}</td>
              <td className="px-4 py-2 text-slate-600">{Number(p.rating).toFixed(1)}</td>
              <td className="px-4 py-2 text-slate-600">{p.review_count}</td>
              <td className="px-4 py-2 text-slate-600">{p.posts}</td>
              <td className="px-4 py-2"><Badge tone="amber">{p.connection_status}</Badge></td>
              <td className="px-4 py-2 text-xs text-slate-500">{formatDate(p.last_synced_at, true)}</td>
              <td className="px-4 py-2 text-right">
                <Link href={`/gmb/${p.client_id}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Open</Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
