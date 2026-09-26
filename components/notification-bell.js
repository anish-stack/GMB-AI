"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, CreditCard, FileText, LifeBuoy, Megaphone, Wrench } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const TYPE_ICON = {
  SUCCESS: CheckCircle2, TASK: CheckCircle2, ALERT: AlertTriangle, WARNING: AlertTriangle, ANNOUNCEMENT: Megaphone,
  MAINTENANCE: Wrench, BILLING: CreditCard, REPORT: FileText, SUPPORT: LifeBuoy,
};
export const TYPE_TONE = {
  ALERT: "text-rose-500", WARNING: "text-amber-500", SUCCESS: "text-emerald-500", TASK: "text-emerald-500",
  ANNOUNCEMENT: "text-violet-500", MAINTENANCE: "text-amber-500", BILLING: "text-sky-500",
};

/** Live notification bell: SSE for real-time counts, FCM foreground events, and a dropdown. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=8", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setUnread(data.unread || 0);
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    let es;
    let fallback;
    const first = setTimeout(load, 0);
    if ("EventSource" in window) {
      es = new EventSource("/api/notifications/stream");
      es.addEventListener("notifications", (e) => {
        try {
          const d = JSON.parse(e.data);
          setUnread(d.unread || 0);
          load();
        } catch { /* ignore */ }
      });
    } else {
      fallback = setInterval(load, 30000);
    }
    const onPush = () => load();
    window.addEventListener("app:notification", onPush);
    return () => {
      clearTimeout(first);
      es?.close();
      clearInterval(fallback);
      window.removeEventListener("app:notification", onPush);
    };
  }, [load]);

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setUnread(0);
    setItems((l) => l.map((i) => ({ ...i, is_read: 1 })));
  }

  async function openItem(it) {
    setOpen(false);
    if (!it.is_read) {
      fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [it.id] }) });
      setUnread((u) => Math.max(0, u - 1));
      setItems((l) => l.map((i) => (i.id === it.id ? { ...i, is_read: 1 } : i)));
    }
    router.push(it.link || "/notifications");
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F53236] px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Notifications</p>
            {unread ? (
              <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs font-semibold text-[#F53236]">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!loaded ? (
              <p className="px-4 py-6 text-center text-xs text-zinc-400">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-zinc-400">You&apos;re all caught up.</p>
            ) : (
              items.map((it) => {
                const Icon = TYPE_ICON[it.type] || Bell;
                return (
                  <button key={it.id} onClick={() => openItem(it)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 ${it.is_read ? "" : "bg-red-50/40 dark:bg-red-950/10"}`}>
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TYPE_TONE[it.type] || "text-zinc-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs ${it.is_read ? "text-zinc-600 dark:text-zinc-300" : "font-semibold text-zinc-900 dark:text-white"}`}>{it.title}</p>
                      {it.body ? <p className="line-clamp-2 text-xs text-zinc-400">{it.body}</p> : null}
                      <p className="mt-0.5 text-[10px] text-zinc-400">{formatDate(it.created_at, true)}</p>
                    </div>
                    {!it.is_read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#F53236]" /> : null}
                  </button>
                );
              })
            )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-zinc-100 px-4 py-2.5 text-center text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
