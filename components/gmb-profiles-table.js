"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Table, EmptyRow, Badge, Input, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export function GmbProfilesTable({ rows }) {
  const [q, setQ] = useState("");
  const [conn, setConn] = useState("");

  const statuses = [...new Set(rows.map((p) => p.connection_status).filter(Boolean))];

  const filtered = rows.filter((p) => {
    if (conn && p.connection_status !== conn) return false;
    if (q && !`${p.business_name} ${p.category}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader
        title={`${filtered.length} of ${rows.length} profiles`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className="!w-40 !py-1.5" />
            <Select value={conn} onChange={(e) => setConn(e.target.value)} className="!w-40">
              <option value="">All connections</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        }
      />
      <Table head={["Business", "Category", "Location id", "Rating", "Reviews", "Posts", "Connection", "Synced", ""]}
        empty={!filtered.length ? <EmptyRow colSpan={9}>No profiles match this filter.</EmptyRow> : null}>
        {filtered.map((p) => (
          <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
            <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{p.business_name}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{p.category}</td>
            <td className="px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">{p.gmb_location_id}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{Number(p.rating).toFixed(1)}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{p.review_count}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{p.posts}</td>
            <td className="px-4 py-2"><Badge tone="amber">{p.connection_status}</Badge></td>
            <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(p.last_synced_at, true)}</td>
            <td className="px-4 py-2 text-right">
              <Link href={`/gmb/${p.client_id}`} className="text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300">Open</Link>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
