import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { dashboardStats, statusBreakdown, topClients, dailyTaskTrend } from "@/lib/repo/stats.js";
import { listTasks } from "@/lib/repo/tasks.js";
import { Card, CardBody, CardHeader, Stat, Table, EmptyRow, Badge } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, truncate } from "@/lib/utils";
import { BarTrend, DistributionBar } from "@/components/charts";
import { requireTenantContext } from "@/lib/saas/context.js";
import { PlanSummary } from "@/components/plan-summary";
import { ExpiryAlert } from "@/components/expiry-alert";

export const dynamic = "force-dynamic";

const STATUS_COLOR = {
  READY_FOR_REVIEW: "bg-emerald-500",
  NEEDS_REVIEW: "bg-amber-500",
  APPROVED: "bg-violet-500",
  PUBLISHED: "bg-brand-500",
  POST_DELETED: "bg-rose-500",
  REJECTED: "bg-rose-500",
  FAILED: "bg-rose-700",
};

export default async function DashboardPage() {
  const ctx = await requireTenantContext();
  const T = ctx.tenantId;
  const [stats, breakdown, tasks, clients, trend] = await Promise.all([
    dashboardStats(T),
    statusBreakdown(T),
    listTasks({ status: ["READY_FOR_REVIEW", "NEEDS_REVIEW"], limit: 8, tenantId: T }),
    topClients(6, T),
    dailyTaskTrend(7, T),
  ]);

  const trendData = trend.map((d) => ({
    label: new Date(d.day).toLocaleDateString("en-IN", { weekday: "short" }),
    value: Number(d.generated),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Today&apos;s AI output and everything waiting on a human decision.
        </p>
      </div>

      <ExpiryAlert ent={ctx.ent} />
      <PlanSummary ent={JSON.parse(JSON.stringify(ctx.ent))} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Clients" value={stats.total_clients} sub={`${stats.total_profiles} GMB profiles`} tone="indigo" />
        <Stat label="Generated today" value={stats.generated_today} sub={`${stats.published} published all-time`} tone="blue" />
        <Stat label="Awaiting approval" value={stats.awaiting} sub={`${stats.ready} ready, ${stats.needs_review} need attention`} tone="amber" />
        <Stat label="Average AI score" value={stats.avg_score ?? "-"} sub={`AI success rate ${stats.ai_success_rate}%`} tone="emerald" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Tasks generated - last 7 days" subtitle="Includes ready, published and rejected" />
          <CardBody>
            {trendData.some((d) => d.value > 0) ? (
              <BarTrend data={trendData} />
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No task activity in the last 7 days.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pipeline distribution" subtitle="Share of all tasks by status" />
          <CardBody>
            {breakdown.length ? (
              <DistributionBar
                items={breakdown.map((b) => ({
                  label: b.status.replaceAll("_", " "),
                  value: Number(b.total),
                  colorClass: STATUS_COLOR[b.status] || "bg-zinc-400",
                }))}
              />
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No tasks yet.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Review queue"
            subtitle="Open a task to review, edit and approve"
            action={
              <Link href="/gmb/tasks" className="inline-flex items-center gap-1 text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300">
                Open queue <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <Table head={["Client", "Topic", "Title", "Score", "Status", ""]}
            empty={!tasks.length ? <EmptyRow colSpan={6}>Nothing waiting. Run the AI job to generate today&apos;s posts.</EmptyRow> : null}>
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                <td className="px-4 py-2">
                  <p className="font-medium text-zinc-800 dark:text-zinc-100">{t.business_name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.city}</p>
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{truncate(t.topic, 34)}</td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{truncate(t.title, 44)}</td>
                <td className="px-4 py-2">
                  <Badge tone={t.qa_score >= 80 ? "emerald" : "amber"}>{t.qa_score ?? "-"}/100</Badge>
                </td>
                <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/gmb/tasks/${t.id}`} className="text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300">Review</Link>
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
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{b.total}</span>
                </div>
              )) : <p className="text-sm text-zinc-500 dark:text-zinc-400">No tasks yet.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Most active clients" />
            <CardBody className="space-y-2">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <Link href={`/clients/${c.id}`} className="truncate text-zinc-700 dark:text-zinc-300 hover:text-[#F53236] dark:text-brand-400">
                    {c.business_name}
                  </Link>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{c.published || 0} published</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Last AI job: {stats.generated_today} tasks created today &middot; average AI call {stats.avg_duration || 0} ms &middot;{" "}
        {stats.ai_errors} AI errors logged. Publishing uses the mock provider - {formatDate(new Date(), true)}.
      </p>
    </div>
  );
}
