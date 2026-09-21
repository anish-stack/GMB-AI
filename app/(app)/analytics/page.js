import Link from "next/link";
import { query } from "@/lib/db";
import { requireTenantContext } from "@/lib/saas/context.js";
import { dashboardStats, performanceTotals, topClients, statusBreakdown } from "@/lib/repo/stats.js";
import { Card, CardBody, CardHeader, Stat, Table, EmptyRow, Badge } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const ctx = await requireTenantContext();
  const T = ctx.tenantId;
  const [stats, perf, clients, breakdown, daily] = await Promise.all([
    dashboardStats(T),
    performanceTotals(T),
    topClients(10, T),
    statusBreakdown(T),
    query(
      `SELECT DATE(created_at) day, COUNT(*) tasks, ROUND(AVG(qa_score),1) avg_score,
              SUM(status='PUBLISHED') published, SUM(status='REJECTED') rejected
         FROM ai_tasks WHERE tenant_id=? GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 14`,
      [T]
    ),
  ]);

  const maxTasks = Math.max(1, ...daily.map((d) => Number(d.tasks)));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Analytics</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">AI throughput, human decisions and mock GMB performance.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Average AI score" value={stats.avg_score ?? "-"} tone="emerald" />
        <Stat label="Human rejection rate" value={`${stats.rejection_rate}%`} sub={`${stats.rejected} rejected`} tone="red" />
        <Stat label="AI success rate" value={`${stats.ai_success_rate}%`} sub={`${stats.ai_errors} failed calls`} tone="indigo" />
        <Stat label="Post views (mock)" value={perf.views} sub={`${perf.clicks} clicks, ${perf.calls} calls`} tone="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Tasks per day" subtitle="Last 14 days" />
          <CardBody className="space-y-1.5">
            {daily.map((d) => (
              <div key={String(d.day)} className="flex items-center gap-3 text-xs">
                <span className="w-24 shrink-0 text-zinc-500 dark:text-zinc-400">{String(d.day).slice(0, 10)}</span>
                <div className="h-3 flex-1 rounded bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-3 rounded bg-indigo-500" style={{ width: `${(Number(d.tasks) / maxTasks) * 100}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right text-zinc-600 dark:text-zinc-400">
                  {d.tasks} tasks &middot; {d.avg_score ?? "-"}
                </span>
              </div>
            ))}
            {!daily.length ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No task history yet.</p> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Status breakdown" />
          <CardBody className="space-y-2">
            {breakdown.map((b) => (
              <div key={b.status} className="flex items-center justify-between text-sm">
                <StatusBadge status={b.status} />
                <span className="text-zinc-700 dark:text-zinc-300">{b.total}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Client performance" />
        <Table head={["Client", "City", "Tasks", "Published", "Average score", ""]}
          empty={!clients.length ? <EmptyRow colSpan={6}>No data yet.</EmptyRow> : null}>
          {clients.map((c) => (
            <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{c.business_name}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{c.city}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{c.tasks}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{c.published || 0}</td>
              <td className="px-4 py-2">
                <Badge tone={Number(c.avg_score) >= 80 ? "emerald" : "amber"}>{c.avg_score ?? "-"}</Badge>
              </td>
              <td className="px-4 py-2 text-right">
                <Link href={`/clients/${c.id}`} className="text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300">Open</Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Performance numbers come from the mock GMB provider. Connect the Google Business Profile API to replace them.
      </p>
    </div>
  );
}
