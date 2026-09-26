"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { Card, Button, Alert, Skeleton, PanelHeader } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";

const S = {
  OK: [CheckCircle2, "text-emerald-600", "Healthy"],
  WARNING: [AlertTriangle, "text-amber-600", "Warning"],
  CRITICAL: [XCircle, "text-rose-600", "Critical"],
  UNKNOWN: [CircleDashed, "text-zinc-400", "Not checked"],
};
const SEV = { CRITICAL: "text-rose-600", WARNING: "text-amber-600", INFO: "text-zinc-500" };

export function ListingHealth() {
  const { data, error, loading, mutate, reload } = useApi("/api/listing-health");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const items = data?.items || [];
  const count = (st) => items.filter((i) => i.status === st).length;
  async function check(clientId) {
    setBusy(clientId || "all");
    setMsg("");
    try {
      const r = await apiFetch("/api/listing-health", { body: clientId ? { client_id: clientId } : {} });
      if (r.items) mutate({ items: r.items });
      else reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <PanelHeader icon={ShieldAlert} title="Listing health" subtitle="Suspensions, lost access, duplicates, verification, stale posts and unanswered reviews - checked nightly and in real time"
          actions={<Button onClick={() => check(null)} disabled={Boolean(busy)}>{busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Check all now</Button>} />
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5">
          {["CRITICAL", "WARNING", "OK", "UNKNOWN"].map((k) => {
            const [Icon, cls, label] = S[k];
            return <div key={k} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60"><p className={`flex items-center gap-1 text-xs ${cls}`}><Icon className="h-3.5 w-3.5" /> {label}</p><p className="mt-1 text-xl font-bold">{count(k)}</p></div>;
          })}
        </div>
      </Card>
      {msg ? <Alert>{msg}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      {loading && !items.length ? <Skeleton className="h-40" /> : (
        <div className="space-y-2">
          {items.map((i) => {
            const [Icon, cls, label] = S[i.status] || S.UNKNOWN;
            return (
              <Card key={i.client_id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cls}`} />
                    <div className="min-w-0">
                      <Link href={`/gmb/${i.client_id}`} className="font-semibold text-zinc-900 hover:underline dark:text-white">{i.business_name}</Link>
                      <p className="text-xs text-zinc-500">{label}{i.city ? ` · ${i.city}` : ""} · {i.checked_at ? `checked ${formatDate(i.checked_at, true)}` : "never checked"}</p>
                      {i.issues.length ? (
                        <ul className="mt-2 space-y-1">{i.issues.map((x) => <li key={x.code} className={`text-sm ${SEV[x.severity]}`}>• {x.message}</li>)}</ul>
                      ) : i.checked_at ? <p className="mt-1 text-sm text-emerald-600">All good.</p> : null}
                    </div>
                  </div>
                  <Button variant="secondary" className="!py-1.5 text-xs" disabled={Boolean(busy)} onClick={() => check(i.client_id)}>
                    {busy === i.client_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Check
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
