import Link from "next/link";
import { Plus } from "lucide-react";
import { listClients } from "@/lib/repo/clients.js";
import { Card, CardHeader, Table, EmptyRow, Badge, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await listClients();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">Business data the AI is allowed to use.</p>
        </div>
        <Link href="/clients/new"><Button><Plus className="h-3.5 w-3.5" /> New client</Button></Link>
      </div>

      <Card>
        <CardHeader title={`${clients.length} clients`} />
        <Table head={["Business", "Category", "City", "Services", "Keywords", "Posts", "Owner", "GMB", ""]}
          empty={!clients.length ? <EmptyRow colSpan={9}>No clients yet. Add one to start generating posts.</EmptyRow> : null}>
          {clients.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-medium text-slate-800">{c.business_name}</td>
              <td className="px-4 py-2 text-slate-600">{c.business_category}</td>
              <td className="px-4 py-2 text-slate-600">{c.city}</td>
              <td className="px-4 py-2 text-slate-600">{c.service_count}</td>
              <td className="px-4 py-2 text-slate-600">{c.keyword_count}</td>
              <td className="px-4 py-2 text-slate-600">{c.post_count}</td>
              <td className="px-4 py-2 text-slate-600">{c.employee_name || "-"}</td>
              <td className="px-4 py-2"><Badge tone="amber">{c.gmb_connection_status}</Badge></td>
              <td className="px-4 py-2 text-right">
                <Link href={`/clients/${c.id}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Open</Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
