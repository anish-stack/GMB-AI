"use client";

import { Activity, AlertTriangle, CheckCircle2, CircleDashed, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Card, Button, Alert, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";

const S = {
  HEALTHY: [CheckCircle2, "text-emerald-600", "bg-emerald-50 dark:bg-emerald-950/30", "Healthy"],
  WARNING: [AlertTriangle, "text-amber-600", "bg-amber-50 dark:bg-amber-950/30", "Warning"],
  FAILED: [XCircle, "text-rose-600", "bg-rose-50 dark:bg-rose-950/30", "Failed"],
  NOT_CONFIGURED: [CircleDashed, "text-zinc-400", "bg-zinc-50 dark:bg-zinc-800/60", "Not configured"],
};

export function HealthAdmin() {
  const { data, error, loading, reload } = useApi("/api/admin/health");
  const [OIcon, ocls, obg, olabel] = S[data?.overall || "NOT_CONFIGURED"];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"><Activity className="h-5 w-5" /> System health</h1>
          <p className="text-sm text-zinc-500">Live checks of database, workers, storage, integrations and the server process.</p>
        </div>
        <Button onClick={reload} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Run checks</Button>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {loading && !data ? <Skeleton className="h-72" /> : null}
      {data ? (
        <>
          <Card className={`flex items-center gap-4 p-5 ${obg}`}>
            <OIcon className={`h-10 w-10 ${ocls}`} />
            <div>
              <p className={`text-xl font-bold ${ocls}`}>{olabel}</p>
              <p className="text-xs text-zinc-500">{data.results.length} checks in {data.duration_ms} ms · {formatDate(data.at, true)}</p>
            </div>
          </Card>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.results.map((r) => {
              const [Icon, cls, bg, label] = S[r.status] || S.NOT_CONFIGURED;
              return (
                <Card key={r.name} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}><Icon className={`h-4 w-4 ${cls}`} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-zinc-900 dark:text-white">{r.label}</p>
                        <span className={`text-xs font-semibold ${cls}`}>{label}</span>
                      </div>
                      <p className="mt-0.5 break-words text-xs text-zinc-500">{r.message}</p>
                      {r.meta ? (
                        <details className="mt-1 text-[11px] text-zinc-400">
                          <summary className="cursor-pointer">details{r.ms ? ` · ${r.ms} ms` : ""}</summary>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(r.meta, null, 2)}</pre>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <Card className="p-5">
            <p className="mb-2 text-sm font-semibold">Background workers</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-zinc-500"><th className="py-1">Worker</th><th>Last run</th><th>Last success</th><th>Status</th><th>Message</th></tr></thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.heartbeats.map((h) => (
                  <tr key={h.name}><td className="py-2 font-mono text-xs">{h.name}</td><td className="text-xs">{formatDate(h.last_run_at, true)}</td><td className="text-xs">{formatDate(h.last_ok_at, true)}</td><td className="text-xs">{h.status}</td><td className="max-w-xs truncate text-xs text-zinc-500">{h.message}</td></tr>
                ))}
                {!data.heartbeats.length ? <tr><td colSpan={5} className="py-3 text-xs text-zinc-400">No worker has reported yet - start `npm run scheduler`.</td></tr> : null}
              </tbody>
            </table>
          </Card>
          <Card className="p-5">
            <p className="mb-2 text-sm font-semibold">Recent runs</p>
            <div className="flex flex-wrap gap-2">
              {data.history.map((h) => <span key={h.id} className={`rounded-lg px-2 py-1 text-[11px] ${S[h.overall]?.[2]}`}>{formatDate(h.created_at, true)} · {h.overall} · {h.duration_ms}ms · {h.run_by}</span>)}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
