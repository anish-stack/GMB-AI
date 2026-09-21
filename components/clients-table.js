"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Table, EmptyRow, Badge, Input, Select } from "@/components/ui";

export function ClientsTable({ clients, limit }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");

  const categories = [...new Set(clients.map((c) => c.business_category).filter(Boolean))];

  const rows = clients.filter((c) => {
    if (status === "active" && !c.active) return false;
    if (status === "inactive" && c.active) return false;
    if (category && c.business_category !== category) return false;
    if (q) {
      const hay = `${c.business_name} ${c.city} ${c.business_category}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <Card>
      <CardHeader
        title={`${rows.length} of ${clients.length} clients`}
        subtitle={`Plan limit: ${Number(limit) < 0 ? "unlimited" : limit}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className="!w-40 !py-1.5" />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="!w-40">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-32">
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        }
      />
      <Table head={["Business", "Category", "City", "Services", "Keywords", "Posts", "Owner", "GMB", "Status", ""]}
        empty={!rows.length ? <EmptyRow colSpan={10}>No clients match this filter.</EmptyRow> : null}>
        {rows.map((c) => (
          <tr key={c.id} className={c.active ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/60" : "bg-zinc-50/60 dark:bg-zinc-800/40 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}>
            <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{c.business_name}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{c.business_category}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{c.city}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{c.service_count}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{c.keyword_count}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{c.post_count}</td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{c.employee_name || "-"}</td>
            <td className="px-4 py-2"><Badge tone="amber">{c.gmb_connection_status}</Badge></td>
            <td className="px-4 py-2">{c.active ? <Badge tone="emerald">Active</Badge> : <Badge tone="red">Inactive</Badge>}</td>
            <td className="px-4 py-2 text-right">
              <Link href={`/clients/${c.id}`} className="text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300">Open</Link>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
