"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Card, CardHeader, Table, EmptyRow, Badge, Button, Select, Input } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export function SubscriptionList({ subscriptions }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const rows = subscriptions.filter(
    (s) => (!status || s.status === status) && (!q || s.tenant_name.toLowerCase().includes(q.toLowerCase()))
  );

  async function runCycle() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/subscriptions", { method: "POST" });
    const json = await res.json();
    setBusy(false);
    setMsg(
      json.error
        ? json.error
        : `${json.renewed} renewed · ${json.pastDue} moved to past due · ${json.expired} expired · ${json.trialsEnded} trials ended`
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {msg ? <p className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{msg}</p> : null}
      <Card>
        <CardHeader
          title={`${rows.length} subscriptions`}
          subtitle="The billing sweep also runs nightly from scripts/scheduler.js"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input placeholder="Search tenant..." value={q} onChange={(e) => setQ(e.target.value)} className="!w-40 !py-1.5" />
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-40">
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="TRIALING">Trialing</option>
                <option value="PAST_DUE">Past due</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </Select>
              <Button onClick={runCycle} disabled={busy}>
                <RefreshCw className="h-3.5 w-3.5" /> {busy ? "Running..." : "Run billing sweep"}
              </Button>
            </div>
          }
        />
        <Table head={["Tenant", "Plan", "Cycle", "Price", "Status", "Period", "Cancels", ""]}
          empty={!rows.length ? <EmptyRow colSpan={8}>No subscriptions.</EmptyRow> : null}>
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{s.tenant_name}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{s.plan_name}</td>
              <td className="px-4 py-2 text-xs text-zinc-500">{s.billing_cycle}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">₹{s.price}</td>
              <td className="px-4 py-2">
                <Badge tone={s.status === "ACTIVE" ? "emerald" : s.status === "TRIALING" ? "blue" : s.status === "PAST_DUE" ? "amber" : "red"}>
                  {s.status}
                </Badge>
              </td>
              <td className="px-4 py-2 text-xs text-zinc-500">
                {formatDate(s.current_period_start)} → {formatDate(s.current_period_end)}
              </td>
              <td className="px-4 py-2 text-xs text-zinc-500">{s.cancel_at_period_end ? "At period end" : "-"}</td>
              <td className="px-4 py-2 text-right">
                <Link href={`/admin/tenants/${s.tenant_id}`} className="text-xs font-medium text-[#F53236]">Manage</Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
