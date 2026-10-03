"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { Card, Select, Alert } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

/** Per-GMB auto-publish: QA score >= threshold (min 80) posts go live at their scheduled date + time. */
export function AutoPublishCard({ clientId }) {
  const { data, error, mutate } = useApi(`/api/clients/${clientId}/auto-publish`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save(patch) {
    setBusy(true);
    setErr("");
    try {
      mutate(await apiFetch(`/api/clients/${clientId}/auto-publish`, { method: "PUT", body: patch }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return error ? <Alert>{error}</Alert> : null;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/30"><Zap className="h-5 w-5" /></span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white">Auto-publish</p>
            <p className="text-xs text-zinc-500">
              {data.enabled
                ? `ON - posts scoring ${data.min_score}+ go live automatically at the date & time set in the calendar. Lower scores and duplicates wait for you.`
                : "OFF - every post needs manual approval and publishing."}
            </p>
            {!data.allowed ? <p className="mt-1 text-xs text-amber-600">{data.reason}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={data.min_score} disabled={busy || !data.enabled} onChange={(e) => save({ min_score: Number(e.target.value) })} className="!w-auto" aria-label="Minimum QA score">
            {[80, 85, 90, 95].map((n) => <option key={n} value={n}>QA {n}+</option>)}
          </Select>
          <button type="button" role="switch" aria-checked={data.enabled} disabled={busy || (!data.allowed && !data.enabled)} onClick={() => save({ enabled: !data.enabled })}
            className={`relative h-7 w-12 rounded-full transition ${data.enabled ? "bg-violet-500" : "bg-zinc-300 dark:bg-zinc-700"} disabled:opacity-50`}>
            {busy ? <Loader2 className="absolute left-3.5 top-1 h-5 w-5 animate-spin text-white" /> : <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${data.enabled ? "left-6" : "left-1"}`} />}
          </button>
        </div>
      </div>
      {err ? <Alert className="mt-3">{err}</Alert> : null}
    </Card>
  );
}
