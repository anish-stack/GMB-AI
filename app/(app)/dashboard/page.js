import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { dashboardStats, statusBreakdown, topClients } from "@/lib/repo/stats.js";
import { listTasks } from "@/lib/repo/tasks.js";
import { Card, CardBody, CardHeader, Stat, Table, EmptyRow, Badge } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, breakdown, tasks, clients] = await Promise.all([
    dashboardStats(),
    statusBreakdown(),
    listTasks({ status: ["READY_FOR_REVIEW", "NEEDS_REVIEW"], limit: 8 }),
    topClients(6),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Today&apos;s AI output and everything waiting on a human decision.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Clients" value={stats.total_clients} sub={`${stats.total_profiles} GMB profiles`} tone="indigo" />
        <Stat label="Generated today" value={stats.generated_today} sub={`${stats.published} published all-time`} tone="blue" />
        <Stat label="Awaiting approval" value={stats.awaiting} sub={`${stats.ready} ready, ${stats.needs_review} need attention`} tone="amber" />
        <Stat label="Average AI score" value={stats.avg_score ?? "-"} sub={`AI success rate ${stats.ai_success_rate}%`} tone="emerald" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Review queue"
            subtitle="Open a task to review, edit and approve"
            action={
              <Link href="/gmb/tasks" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                Open queue <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <Table head={["Client", "Topic", "Title", "Score", "Status", ""]}
            empty={!tasks.length ? <EmptyRow colSpan={6}>Nothing waiting. Run the AI job to generate today&apos;s posts.</EmptyRow> : null}>
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <p className="font-medium text-slate-800">{t.business_name}</p>
                  <p className="text-xs text-slate-500">{t.city}</p>
                </td>
                <td className="px-4 py-2 text-slate-600">{truncate(t.topic, 34)}</td>
                <td className="px-4 py-2 text-slate-600">{truncate(t.title, 44)}</td>
                <td className="px-4 py-2">
                  <Badge tone={t.qa_score >= 80 ? "emerald" : "amber"}>{t.qa_score ?? "-"}/100</Badge>
                </td>
                <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/gmb/tasks/${t.id}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Review</Link>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Pipeline status" subtitle="All AI tasks by state" />
            <CardBody className="space-y-2">
              {breakdown.length ? breakdown.map((b) => (
                <div key={b.status} className="flex items-center justify-between text-sm">
                  <StatusBadge status={b.status} />
                  <span className="font-medium text-slate-700">{b.total}</span>
                </div>
              )) : <p className="text-sm text-slate-500">No tasks yet.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Most active clients" />
            <CardBody className="space-y-2">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <Link href={`/clients/${c.id}`} className="truncate text-slate-700 hover:text-indigo-600">
                    {c.business_name}
                  </Link>
                  <span className="text-xs text-slate-500">{c.published || 0} published</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Last AI job: {stats.generated_today} tasks created today &middot; average AI call {stats.avg_duration || 0} ms &middot;{" "}
        {stats.ai_errors} AI errors logged. Publishing uses the mock provider - {formatDate(new Date(), true)}.
      </p>
    </div>
  );
}
