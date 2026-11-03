import { requirePagePermission } from "@/lib/saas/context.js";
import { query } from "@/lib/db";
import { agentUsage } from "@/lib/repo/stats.js";
import { Card, CardHeader, Table, EmptyRow, Stat } from "@/components/ui";
import { AiRunsTable } from "@/components/ai-runs-table";

export const dynamic = "force-dynamic";

export default async function AiRunsPage() {
  // requirePagePermission already returns the (request-cached) tenant context
  const ctx = await requirePagePermission("task.view");
  const [runs, agents] = await Promise.all([
    // Only the columns the table shows; previews are cut in SQL so we never ship LONGTEXT to the browser
    query(
      `SELECT e.id, e.created_at, e.task_id, e.agent, e.provider, e.model,
              e.duration_ms, e.status, LEFT(e.error, 120) AS error,
              LEFT(e.output_preview, 120) AS output_preview, c.business_name
         FROM ai_executions e
         LEFT JOIN clients c ON c.id=e.client_id
        WHERE e.tenant_id=?
        ORDER BY e.id DESC LIMIT 200`,
      [ctx.tenantId]
    ),
    agentUsage(ctx.tenantId),
  ]);

  // Top stat cards come from the per-agent GROUP BY rows - no extra queries
  const total = agents.reduce((n, a) => n + Number(a.calls || 0), 0);
  const failed = agents.reduce((n, a) => n + Number(a.failures || 0), 0);
  const stats = {
    ai_calls: total,
    ai_errors: failed,
    ai_success_rate: total ? Math.round(((total - failed) / total) * 100) : 100,
    credits_used: agents.reduce((n, a) => n + Number(a.credits || 0), 0),
  };

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