"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Table, EmptyRow, Badge, Select } from "@/components/ui";
import { formatDate, truncate } from "@/lib/utils";

export function AiRunsTable({ runs }) {
  const [status, setStatus] = useState("");
  const [agent, setAgent] = useState("");

  const agents = [...new Set(runs.map((r) => r.agent).filter(Boolean))];

  const rows = runs.filter((r) => {
    if (status && r.status !== status) return false;
    if (agent && r.agent !== agent) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader
        title="Recent executions"
        subtitle={`${rows.length} of ${runs.length} · newest first`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={agent} onChange={(e) => setAgent(e.target.value)} className="!w-40">
              <option value="">All agents</option>
              {agents.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-36">
              <option value="">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="FALLBACK">Fallback</option>
              <option value="ERROR">Error</option>
            </Select>
          </div>
        }
      />
      <Table head={["Time", "Client", "Agent", "Provider", "Model", "Duration", "Status", "Output"]}
        empty={!rows.length ? <EmptyRow colSpan={8}>No executions match this filter.</EmptyRow> : null}>
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
            <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(r.created_at, true)}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
              {r.task_id ? (
                <Link href={`/gmb/tasks/${r.task_id}`} className="hover:text-[#F53236] dark:text-brand-400">{r.business_name || "-"}</Link>
              ) : (r.business_name || "-")}
            </td>
            <td className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">{r.agent}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{r.provider}</td>
            <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{truncate(r.model, 30)}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{r.duration_ms} ms</td>
            <td className="px-4 py-2">
              <Badge tone={r.status === "SUCCESS" ? "emerald" : r.status === "FALLBACK" ? "amber" : "red"}>{r.status}</Badge>
            </td>
            <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{truncate(r.error || r.output_preview, 60)}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
