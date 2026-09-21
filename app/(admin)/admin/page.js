import Link from "next/link";
import { Building2, Users, IndianRupee, Coins, ArrowRight } from "lucide-react";
import { platformStats, revenueTrend, planDistribution, listTenants } from "@/lib/saas/tenants.js";
import { platformUsage } from "@/lib/saas/usage.js";
import { Card, CardBody, CardHeader, Stat, Table, EmptyRow, Badge } from "@/components/ui";
import { BarTrend, DistributionBar } from "@/components/charts";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [stats, revenue, plans, usage, tenants] = await Promise.all([
    platformStats(),
    revenueTrend(6),
    planDistribution(),
    platformUsage(),
    listTenants(),
  ]);

  const trend = revenue.map((r) => ({ label: r.period.slice(5), value: Number(r.revenue) }));
  const colors = ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-rose-500"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Platform overview</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Every tenant, subscription and rupee in one place.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={`₹${Number(stats.mrr || 0).toLocaleString("en-IN")}`} sub={`₹${Number(stats.revenue || 0).toLocaleString("en-IN")} collected all-time`} tone="emerald" icon={IndianRupee} />
        <Stat label="Tenants" value={stats.tenants} sub={`${stats.active_tenants} active · ${stats.suspended_tenants} suspended`} tone="indigo" icon={Building2} />
        <Stat label="Subscriptions" value={stats.active_subs} sub={`${stats.trials} on trial`} tone="blue" icon={Users} />
        <Stat label="Credits consumed" value={stats.credits_used || 0} sub={`${stats.tasks} posts generated`} tone="amber" icon={Coins} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue - last 6 months" subtitle="Paid invoices only" />
          <CardBody>
            {trend.some((t) => t.value > 0) ? <BarTrend data={trend} /> : <p className="text-sm text-zinc-500">No paid invoices yet.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Plan distribution" />
          <CardBody>
            {plans.some((p) => Number(p.tenants) > 0) ? (
              <DistributionBar
                items={plans.map((p, i) => ({
                  label: p.name,
                  value: Number(p.tenants),
                  colorClass: colors[i % colors.length],
                }))}
              />
            ) : (
              <p className="text-sm text-zinc-500">No subscriptions yet.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Tenants"
          subtitle={`${tenants.length} accounts`}
          action={
            <Link href="/admin/tenants" className="inline-flex items-center gap-1 text-xs font-medium text-[#F53236]">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        <Table head={["Tenant", "Owner", "Plan", "Status", "Clients", "Credits", "Renews", ""]}
          empty={!tenants.length ? <EmptyRow colSpan={8}>No tenants yet.</EmptyRow> : null}>
          {tenants.slice(0, 10).map((t) => (
            <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{t.name}</td>
              <td className="px-4 py-2 text-xs text-zinc-500">{t.owner_email}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{t.plan_name || "-"}</td>
              <td className="px-4 py-2">
                <Badge tone={t.status === "ACTIVE" ? "emerald" : "red"}>{t.status}</Badge>
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{t.client_count}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                {Number(t.plan_credits || 0) + Number(t.purchased_credits || 0)}
              </td>
              <td className="px-4 py-2 text-xs text-zinc-500">{t.current_period_end ? formatDate(t.current_period_end) : "-"}</td>
              <td className="px-4 py-2 text-right">
                <Link href={`/admin/tenants/${t.id}`} className="text-xs font-medium text-[#F53236]">Open</Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <CardHeader title="This month's AI usage by tenant" />
        <Table head={["Tenant", "Posts generated", "Published", "AI calls", "Credits"]}
          empty={!usage.length ? <EmptyRow colSpan={5}>No usage recorded this month.</EmptyRow> : null}>
          {usage.map((u) => (
            <tr key={u.tenant_id}>
              <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{u.tenant_name}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{u.posts_generated}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{u.posts_published}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{u.ai_calls}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{u.credits}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
