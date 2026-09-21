"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, CheckCircle2, XCircle, Send } from "lucide-react";
import { formatDate } from "@/lib/utils";

const ICONS = {
  approve: CheckCircle2,
  reject: XCircle,
  publish: Send,
  edit: Bell,
  regenerate: Bell,
  failed: AlertTriangle,
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const failedCount = items.filter((i) => i.type === "failed").length;

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Bell className="h-4 w-4" />
        {failedCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Recent activity</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!loaded ? (
              <p className="px-3.5 py-6 text-center text-xs text-zinc-400">Loading...</p>
            ) : items.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-xs text-zinc-400">Nothing new.</p>
            ) : (
              items.map((it) => {
                const Icon = ICONS[it.type] || Bell;
                return (
                  <button
                    key={it.id}
                    onClick={() => { setOpen(false); if (it.taskId) router.push(`/gmb/tasks/${it.taskId}`); }}
                    className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${it.type === "failed" || it.type === "reject" ? "text-rose-500" : it.type === "publish" || it.type === "approve" ? "text-emerald-500" : "text-zinc-400"}`} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">{it.title}</p>
                      {it.detail ? <p className="truncate text-xs text-zinc-400">{it.detail}</p> : null}
                      <p className="mt-0.5 text-[10px] text-zinc-400">{formatDate(it.at, true)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
