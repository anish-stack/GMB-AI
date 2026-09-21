import { query } from "@/lib/db";
import { requireTenantContext } from "@/lib/saas/context.js";
import { agentUsage, dashboardStats } from "@/lib/repo/stats.js";
import { Card, CardHeader, Table, EmptyRow, Stat } from "@/components/ui";
import { AiRunsTable } from "@/components/ai-runs-table";

export const dynamic = "force-dynamic";

export default async function AiRunsPage() {
  const ctx = await requireTenantContext();
  const [runs, agents, stats] = await Promise.all([
    query(
      `SELECT e.*, c.business_name FROM ai_executions e
         LEFT JOIN clients c ON c.id=e.client_id
        WHERE e.tenant_id=?
        ORDER BY e.id DESC LIMIT 200`,
      [ctx.tenantId]
    ),
    agentUsage(ctx.tenantId),
    dashboardStats(ctx.tenantId),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI runs</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Every agent call, with tokens, duration and cost where the provider reports it.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="AI calls" value={stats.ai_calls} tone="indigo" />
        <Stat label="Failures" value={stats.ai_errors} tone="red" />
        <Stat label="Success rate" value={`${stats.ai_success_rate}%`} tone="emerald" />
        <Stat label="Credits used" value={stats.credits_used ?? 0} sub={`Wallet balance ${ctx.ent.wallet.balance}`} tone="amber" />
      </div>

      <Card>
        <CardHeader title="Cost and usage by agent" />
        <Table head={["Agent", "Calls", "Failures", "Avg duration", "Input tokens", "Output tokens", "Credits"]}
          empty={!agents.length ? <EmptyRow colSpan={7}>No AI calls recorded yet.</EmptyRow> : null}>
          {agents.map((a) => (
            <tr key={a.agent}>
              <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{a.agent}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.calls}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.failures}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.avg_ms} ms</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.in_tokens}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.out_tokens}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.credits || 0}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <AiRunsTable runs={JSON.parse(JSON.stringify(runs))} />
    </div>
  );
}
