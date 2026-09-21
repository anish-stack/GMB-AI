"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Table, EmptyRow, Badge, Input, Select } from "@/components/ui";
import { truncate } from "@/lib/utils";

export function KeywordsTable({ rows, clientFiltered }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");

  const types = [...new Set(rows.map((k) => k.kw_type).filter(Boolean))];

  const filtered = rows.filter((k) => {
    if (type && k.kw_type !== type) return false;
    if (source && k.source !== source) return false;
    if (q && !`${k.keyword} ${k.business_name}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader
        title={`${filtered.length} of ${rows.length} keywords`}
        subtitle={clientFiltered ? "Filtered by client" : "All clients"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search keyword..." value={q} onChange={(e) => setQ(e.target.value)} className="!w-44 !py-1.5" />
            <Select value={type} onChange={(e) => setType(e.target.value)} className="!w-32">
              <option value="">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select value={source} onChange={(e) => setSource(e.target.value)} className="!w-36">
              <option value="">All sources</option>
              <option value="CLIENT">Client</option>
              <option value="AI_SUGGESTED">AI suggested</option>
            </Select>
          </div>
        }
      />
      <Table head={["Keyword", "Client", "Type", "Source", "Relevance", "Priority", "Reason"]}
        empty={!filtered.length ? <EmptyRow colSpan={7}>No keywords match this filter.</EmptyRow> : null}>
        {filtered.map((k) => (
          <tr key={k.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
            <td className="px-4 py-2 text-zinc-800 dark:text-zinc-100">{k.keyword}</td>
            <td className="px-4 py-2">
              <Link href={`/clients/${k.client_id}`} className="text-zinc-600 dark:text-zinc-400 hover:text-[#F53236] dark:text-brand-400">{k.business_name}</Link>
            </td>
            <td className="px-4 py-2"><Badge>{k.kw_type}</Badge></td>
            <td className="px-4 py-2">
              <Badge tone={k.source === "CLIENT" ? "emerald" : "blue"}>{k.source === "CLIENT" ? "Client" : "AI suggested"}</Badge>
            </td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{k.relevance_score}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{k.priority}</td>
            <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{truncate(k.reason, 80)}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
