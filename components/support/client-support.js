"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LifeBuoy, Plus } from "lucide-react";
import { Card, Button, Field, Input, Select, Alert, Skeleton, EmptyState, PanelHeader, Modal, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";
import { StatusBadge, PRIORITY_TONE, label, Thread, Composer, postForm } from "./ticket-ui";

const CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "GMB", "API", "FEATURE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function SupportList({ clients }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "GENERAL", priority: "MEDIUM", client_id: "" });
  const { data, error, loading } = useApi(`/api/support/tickets?status=${status}&q=${encodeURIComponent(q)}`);
  const items = data?.items || [];

  return (
    <Card className="overflow-hidden">
      <PanelHeader icon={LifeBuoy} title="Support" subtitle="Raise a ticket - our team usually replies within one business day" count={data?.total || null}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New ticket</Button>} />
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:!w-52" aria-label="Status">
            <option value="">All tickets</option>
            <option value="ACTIVE">Active</option>
            {["OPEN", "IN_PROGRESS", "WAITING_FOR_CLIENT", "RESOLVED", "CLOSED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject or ticket no." />
        </div>
        {error ? <Alert>{error}</Alert> : null}
        {loading && !items.length ? <Skeleton className="h-24" /> : items.length ? (
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {items.map((t) => (
              <li key={t.id}>
                <Link href={`/support/${t.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-900">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.subject}</p>
                    <p className="text-xs text-zinc-500">{t.ticket_no} · {label(t.category)}{t.client_name ? ` · ${t.client_name}` : ""} · updated {formatDate(t.updated_at, true)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {t.last_reply_by === "ADMIN" && !["RESOLVED", "CLOSED"].includes(t.status) ? <Badge tone="violet">New reply</Badge> : null}
                    <Badge tone={PRIORITY_TONE[t.priority]}>{label(t.priority)}</Badge>
                    <StatusBadge status={t.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={LifeBuoy} title="No tickets" text="Stuck on something? Open a ticket and we'll help." action={<Button onClick={() => setOpen(true)}>New ticket</Button>} />}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New support ticket" size="lg">
        <div className="space-y-3">
          <Field label="Subject"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} placeholder="Short summary of the issue" /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select></Field>
            <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select></Field>
            <Field label="Client (optional)"><Select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}><option value="">-</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}</Select></Field>
          </div>
          <Composer placeholder="Describe the problem, steps to reproduce, and what you expected…" onSend={async (fd) => {
            Object.entries(form).forEach(([k, v]) => fd.append(k, v));
            const res = await postForm("/api/support/tickets", fd);
            setOpen(false);
            router.push(`/support/${res.ticket.id}`);
          }} />
        </div>
      </Modal>
    </Card>
  );
}

export function TicketView({ id }) {
  const { data, error, loading, mutate } = useApi(`/api/support/tickets/${id}`);
  const t = data?.ticket;
  if (loading && !t) return <Skeleton className="h-64" />;
  if (error) return <Alert>{error}</Alert>;
  if (!t) return null;
  const closed = t.status === "CLOSED";
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/support" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900">← All tickets</Link>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">{t.ticket_no} · {label(t.category)} · opened {formatDate(t.created_at, true)}</p>
            <h1 className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">{t.subject}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={PRIORITY_TONE[t.priority]}>{label(t.priority)}</Badge>
            <StatusBadge status={t.status} />
            <Button variant="secondary" onClick={async () => { const r = await apiFetch(`/api/support/tickets/${id}`, { method: "PATCH", body: { status: closed ? "OPEN" : "CLOSED" } }); mutate(r); }}>
              {closed ? "Re-open" : "Close ticket"}
            </Button>
          </div>
        </div>
      </Card>
      <Thread messages={t.messages} />
      {!closed ? <Composer onSend={async (fd) => mutate(await postForm(`/api/support/tickets/${id}`, fd))} /> : <Alert tone="blue">This ticket is closed. Re-open it to reply.</Alert>}
    </div>
  );
}
