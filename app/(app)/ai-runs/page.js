import Link from "next/link";
import { query } from "@/lib/db";
import { agentUsage, dashboardStats } from "@/lib/repo/stats.js";
import { Card, CardHeader, Table, EmptyRow, Badge, Stat } from "@/components/ui";
import { formatDate, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AiRunsPage() {
  const [runs, agents, stats] = await Promise.all([
    query(
      `SELECT e.*, c.business_name FROM ai_executions e
         LEFT JOIN clients c ON c.id=e.client_id
        ORDER BY e.id DESC LIMIT 200`
    ),
    agentUsage(),
    dashboardStats(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">AI runs</h1>
        <p className="text-sm text-slate-500">Every agent call, with tokens, duration and cost where the provider reports it.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="AI calls" value={stats.ai_calls} tone="indigo" />
        <Stat label="Failures" value={stats.ai_errors} tone="red" />
        <Stat label="Success rate" value={`${stats.ai_success_rate}%`} tone="emerald" />
        <Stat label="Tracked cost" value={stats.total_cost ?? "not priced"} sub="Set AI_COST_PER_1K_INPUT/OUTPUT to price runs" tone="amber" />
      </div>

      <Card>
        <CardHeader title="Cost and usage by agent" />
        <Table head={["Agent", "Calls", "Failures", "Avg duration", "Input tokens", "Output tokens", "Cost"]}
          empty={!agents.length ? <EmptyRow colSpan={7}>No AI calls recorded yet.</EmptyRow> : null}>
          {agents.map((a) => (
            <tr key={a.agent}>
              <td className="px-4 py-2 font-medium text-slate-800">{a.agent}</td>
              <td className="px-4 py-2 text-slate-600">{a.calls}</td>
              <td className="px-4 py-2 text-slate-600">{a.failures}</td>
              <td className="px-4 py-2 text-slate-600">{a.avg_ms} ms</td>
              <td className="px-4 py-2 text-slate-600">{a.in_tokens}</td>
              <td className="px-4 py-2 text-slate-600">{a.out_tokens}</td>
              <td className="px-4 py-2 text-slate-600">{Number(a.cost) ? a.cost : "-"}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <CardHeader title="Recent executions" subtitle="Newest first" />
        <Table head={["Time", "Client", "Agent", "Provider", "Model", "Duration", "Status", "Output"]}
          empty={!runs.length ? <EmptyRow colSpan={8}>Nothing here yet. Run the AI job to populate the log.</EmptyRow> : null}>
          {runs.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 text-xs text-slate-500">{formatDate(r.created_at, true)}</td>
              <td className="px-4 py-2 text-slate-600">
                {r.task_id ? (
                  <Link href={`/gmb/tasks/${r.task_id}`} className="hover:text-indigo-600">{r.business_name || "-"}</Link>
                ) : (r.business_name || "-")}
              </td>
              <td className="px-4 py-2 font-medium text-slate-700">{r.agent}</td>
              <td className="px-4 py-2 text-slate-600">{r.provider}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{truncate(r.model, 30)}</td>
              <td className="px-4 py-2 text-slate-600">{r.duration_ms} ms</td>
              <td className="px-4 py-2">
                <Badge tone={r.status === "SUCCESS" ? "emerald" : r.status === "FALLBACK" ? "amber" : "red"}>{r.status}</Badge>
              </td>
              <td className="px-4 py-2 text-xs text-slate-500">{truncate(r.error || r.output_preview, 60)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
