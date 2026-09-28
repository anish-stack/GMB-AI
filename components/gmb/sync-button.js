"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";

/**
 * Pulls the latest data from Google for this listing:
 * location link, profile, services, keywords, logo, links and performance.
 */
export function GmbSyncButton({ clientId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/gmb/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) throw new Error(j.error || "Sync failed");
      if (j.warning) {
        setMsg({ ok: false, text: j.warning });
      } else {
        const im = j.imported && !j.imported.error && !j.imported.skipped ? j.imported : null;
        const parts = [
          j.linked?.title ? `Synced "${j.linked.title}"` : "Synced",
          im ? `${im.services} services, ${im.keywords} new keywords${im.logo ? ", logo" : ""}` : null,
          j.performance_days_cached ? `${j.performance_days_cached} days of performance` : null,
        ].filter(Boolean);
        setMsg({ ok: true, text: parts.join(" · ") });
      }
      router.refresh();
    } catch (e) {
      const notConnected = /token|not connected|refresh|connect/i.test(e.message);
      setMsg({ ok: false, text: notConnected ? "Google isn't connected for this client yet." : e.message, connect: notConnected });
    } finally {
      setBusy(false);
      setTimeout(() => setMsg((m) => (m?.ok ? null : m)), 6000);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {busy ? "Syncing…" : "Sync with Google"}
      </button>
      {msg ? (
        <div
          role="status"
          className={`absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border px-3 py-2 text-xs shadow-lg ${
            msg.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/60 dark:text-rose-200"
          }`}
        >
          <div className="flex items-start gap-2">
            {msg.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            <div className="min-w-0">
              <p>{msg.text}</p>
              {msg.connect ? (
                <Link href={`/clients/${clientId}`} className="mt-1 inline-block font-semibold underline">
                  Connect Google →
                </Link>
              ) : null}
            </div>
            <button type="button" onClick={() => setMsg(null)} className="ml-auto opacity-60 hover:opacity-100" aria-label="Close">
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
