"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Card, Button, EmptyState, Skeleton, Alert, PanelHeader } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";
import { TYPE_ICON, TYPE_TONE } from "@/components/notification-bell";

export function NotificationCenter() {
  const [filter, setFilter] = useState("all");
  const [extra, setExtra] = useState([]);
  const [more, setMore] = useState(false);
  const { data, error, loading, reload, mutate } = useApi(`/api/notifications?limit=30${filter === "unread" ? "&unread=1" : ""}`);
  const items = [...(data?.items || []), ...extra];
  const unread = data?.unread || 0;

  async function read(ids) {
    await apiFetch("/api/notifications", { body: ids ? { ids } : {} });
    const mark = (list) => list.map((i) => (!ids || ids.includes(i.id) ? { ...i, is_read: 1 } : i));
    mutate((d) => ({ ...d, items: mark(d?.items || []), unread: ids ? Math.max(0, (d?.unread || 0) - ids.length) : 0 }));
    setExtra(mark);
  }

  async function loadMore() {
    const last = items[items.length - 1];
    if (!last) return;
    setMore(true);
    try {
      const res = await apiFetch(`/api/notifications?limit=30&before=${last.id}${filter === "unread" ? "&unread=1" : ""}`);
      setExtra((e) => [...e, ...res.items]);
    } finally {
      setMore(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="overflow-hidden">
        <PanelHeader icon={Bell} title="Notifications" subtitle="AI generation results, billing, reports, support and announcements" count={unread ? `${unread} unread` : null}
          actions={
            <>
              <div className="inline-flex rounded-xl bg-zinc-100 p-1 text-xs font-semibold dark:bg-zinc-800">
                {["all", "unread"].map((f) => (
                  <button key={f} type="button" onClick={() => { setFilter(f); setExtra([]); }} className={`rounded-lg px-3 py-1.5 capitalize ${filter === f ? "bg-white shadow-sm dark:bg-zinc-900 dark:text-white" : "text-zinc-500"}`}>{f}</button>
                ))}
              </div>
              <Button variant="secondary" disabled={!unread} onClick={() => read(null)}><CheckCheck className="h-4 w-4" /> Mark all read</Button>
            </>
          } />
        <div className="p-2 sm:p-3">
          {error ? <Alert action={<button className="font-semibold underline" onClick={reload}>Retry</button>}>{error}</Alert> : null}
          {loading && !items.length ? (
            <div className="space-y-2 p-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : items.length ? (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type] || Bell;
                return (
                  <li key={n.id} className={`flex gap-3 rounded-xl px-3 py-3.5 ${n.is_read ? "" : "bg-red-50/40 dark:bg-red-950/10"}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800"><Icon className={`h-4 w-4 ${TYPE_TONE[n.type] || "text-zinc-500"}`} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-sm ${n.is_read ? "text-zinc-700 dark:text-zinc-300" : "font-semibold text-zinc-900 dark:text-white"}`}>{n.title}</p>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-500 dark:bg-zinc-800">{n.type}</span>
                      </div>
                      {n.body ? <p className="mt-0.5 whitespace-pre-line text-sm text-zinc-500 dark:text-zinc-400">{n.body}</p> : null}
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                        <span>{formatDate(n.created_at, true)}</span>
                        {n.link ? <Link href={n.link} onClick={() => !n.is_read && read([n.id])} className="font-semibold text-[#F53236] hover:underline">Open</Link> : null}
                        {!n.is_read ? <button type="button" onClick={() => read([n.id])} className="font-medium hover:text-zinc-700">Mark read</button> : <span>Read {n.read_at ? formatDate(n.read_at, true) : ""}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Bell} title={filter === "unread" ? "No unread notifications" : "No notifications yet"} text="You'll see AI results, reports and announcements here." />
          )}
          {items.length >= 30 ? (
            <div className="p-3">
              <Button variant="secondary" className="w-full" onClick={loadMore} disabled={more}>{more ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Load older</Button>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
