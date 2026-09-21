import { platformUsage, currentPeriod } from "@/lib/saas/usage.js";
import { agentUsage, dashboardStats } from "@/lib/repo/stats.js";
import { query } from "@/lib/db";
import { Card, CardHeader, Table, EmptyRow, Stat, Badge } from "@/components/ui";
import { formatDate, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsagePage() {
  const [usage, agents, stats, runs] = await Promise.all([
    platformUsage(),
    agentUsage(),
    dashboardStats(),
    query(
      `SELECT e.*, t.name AS tenant_name, c.business_name
         FROM ai_executions e
         LEFT JOIN tenants t ON t.id=e.tenant_id
         LEFT JOIN clients c ON c.id=e.client_id
        ORDER BY e.id DESC LIMIT 150`
    ),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Platform usage</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Every AI call across every tenant for {currentPeriod()}.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="AI calls" value={stats.ai_calls} tone="indigo" />
        <Stat label="Failures" value={stats.ai_errors} tone="red" />
        <Stat label="Credits charged" value={stats.credits_used || 0} tone="amber" />
        <Stat label="Provider cost tracked" value={stats.total_cost ?? "-"} tone="emerald" />
      </div>

      <Card>
        <CardHeader title="Usage by tenant this month" />
        <Table head={["Tenant", "Posts generated", "Published", "AI calls", "Credits"]}
          empty={!usage.length ? <EmptyRow colSpan={5}>No usage recorded.</EmptyRow> : null}>
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

      <Card>
        <CardHeader title="Cost by agent" />
        <Table head={["Agent", "Calls", "Failures", "Avg ms", "In tokens", "Out tokens", "Credits", "Provider cost"]}
          empty={!agents.length ? <EmptyRow colSpan={8}>No AI calls yet.</EmptyRow> : null}>
          {agents.map((a) => (
            <tr key={a.agent}>
              <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{a.agent}</td>   
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.calls}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.failures}</td>

              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.avg_ms}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.in_tokens}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.out_tokens}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.credits || 0}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{Number(a.cost) ? a.cost : "-"}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <CardHeader title="Recent executions" />
        <Table head={["Time", "Tenant", "Client", "Agent", "Status", "Credits", "Detail"]}
          empty={!runs.length ? <EmptyRow colSpan={7}>Nothing logged yet.</EmptyRow> : null}>
          {runs.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-2 text-xs text-zinc-500">{formatDate(r.created_at, true)}</td>
              <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-300">{r.tenant_name || "-"}</td>
              <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-300">{r.business_name || "-"}</td>
              <td className="px-4 py-2 text-xs font-medium">{r.agent}</td>
              <td className="px-4 py-2">
                <Badge tone={r.status === "SUCCESS" ? "emerald" : r.status === "FALLBACK" ? "amber" : "red"}>{r.status}</Badge>
              </td>
              <td className="px-4 py-2 text-xs">{r.credits_charged}</td>
              <td className="px-4 py-2 text-xs text-zinc-500">{truncate(r.error || r.output_preview, 60)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
