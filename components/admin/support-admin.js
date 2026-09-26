"use client";

import { useState } from "react";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Card, Input, Select, Alert, Skeleton, EmptyState, Badge, Button } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";
import { StatusBadge, PRIORITY_TONE, label, Thread, Composer, postForm } from "@/components/support/ticket-ui";

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CLIENT", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function SupportAdminList() {
  const [f, setF] = useState({ status: "ACTIVE", priority: "", category: "", q: "" });
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ ...f, page }).toString();
  const { data, error, loading } = useApi(`/api/admin/support?${qs}`);
  const items = data?.items || [];
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"><LifeBuoy className="h-5 w-5" /> Support tickets <span className="text-sm font-normal text-zinc-400">{data?.total ?? ""}</span></h1>
      <div className="grid gap-2 sm:grid-cols-4">
        <Select value={f.status} onChange={set("status")}><option value="">All statuses</option><option value="ACTIVE">Active</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        <Select value={f.priority} onChange={set("priority")}><option value="">All priorities</option>{PRIORITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        <Select value={f.category} onChange={set("category")}><option value="">All categories</option>{["GENERAL", "BILLING", "TECHNICAL", "GMB", "API", "FEATURE"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        <Input value={f.q} onChange={set("q")} placeholder="Search subject, ticket no, tenant" />
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <Card className="overflow-x-auto">
        {loading && !items.length ? <Skeleton className="m-4 h-40" /> : items.length ? (
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-zinc-100 text-left text-xs text-zinc-500 dark:border-zinc-800"><th className="px-4 py-2">Ticket</th><th>Tenant</th><th>Category</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Updated</th></tr></thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-2.5"><Link href={`/admin/support/${t.id}`} className="font-medium text-zinc-900 hover:underline dark:text-white">{t.subject}</Link><div className="text-xs text-zinc-400">{t.ticket_no}{t.last_reply_by === "CLIENT" && !["RESOLVED", "CLOSED"].includes(t.status) ? " · awaiting reply" : ""}</div></td>
                  <td className="text-xs">{t.tenant_name}{t.client_name ? <div className="text-zinc-400">{t.client_name}</div> : null}</td>
                  <td className="text-xs">{label(t.category)}</td>
                  <td><Badge tone={PRIORITY_TONE[t.priority]}>{label(t.priority)}</Badge></td>
                  <td><StatusBadge status={t.status} /></td>
                  <td className="text-xs">{t.assignee_name || "-"}</td>
                  <td className="text-xs text-zinc-500">{formatDate(t.updated_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={LifeBuoy} title="No tickets match" />}
      </Card>
      {data?.total > 30 ? (
        <div className="flex justify-between"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="secondary" disabled={page * 30 >= data.total} onClick={() => setPage(page + 1)}>Next</Button></div>
      ) : null}
    </div>
  );
}

export function SupportAdminTicket({ id }) {
  const { data, error, loading, mutate } = useApi(`/api/admin/support/${id}`);
  const [internal, setInternal] = useState(false);
  const t = data?.ticket;
  if (loading && !t) return <Skeleton className="h-64" />;
  if (error) return <Alert>{error}</Alert>;
  if (!t) return null;
  const patch = async (b) => mutate({ ...data, ...(await apiFetch(`/api/admin/support/${id}`, { method: "PATCH", body: b })) });
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <Link href="/admin/support" className="text-xs font-semibold text-zinc-500">← All tickets</Link>
        <Card className="p-5">
          <p className="text-xs text-zinc-500">{t.ticket_no} · opened {formatDate(t.created_at, true)} by {t.user_name} ({t.user_email})</p>
          <h1 className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">{t.subject}</h1>
        </Card>
        <Thread messages={t.messages} />
        <Composer placeholder={internal ? "Internal note (not visible to the client)…" : "Reply to the client…"}
          extra={<label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-amber-500" /> Internal note</label>}
          onSend={async (fd) => { fd.append("internal", internal ? "1" : "0"); mutate({ ...data, ...(await postForm(`/api/admin/support/${id}`, fd)) }); }} />
      </div>
      <Card className="h-fit space-y-4 p-5 text-sm">
        <div><p className="text-xs text-zinc-500">Tenant</p><Link href={`/admin/tenants/${t.tenant_id}`} className="font-semibold hover:underline">{t.tenant_name}</Link>{t.client_name ? <p className="text-xs text-zinc-500">Client: {t.client_name}</p> : null}</div>
        <label className="block"><span className="text-xs text-zinc-500">Status</span><Select value={t.status} onChange={(e) => patch({ status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></label>
        <label className="block"><span className="text-xs text-zinc-500">Priority</span><Select value={t.priority} onChange={(e) => patch({ priority: e.target.value })}>{PRIORITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></label>
        <label className="block"><span className="text-xs text-zinc-500">Assigned to</span>
          <Select value={t.assigned_to_user_id || ""} onChange={(e) => patch({ assigned_to_user_id: e.target.value || null })}>
            <option value="">Unassigned</option>
            {(data.admins || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </label>
        <p className="text-xs text-zinc-500">Category: {label(t.category)}<br />Last reply: {t.last_reply_by || "-"} {t.last_reply_at ? formatDate(t.last_reply_at, true) : ""}</p>
      </Card>
    </div>
  );
}
