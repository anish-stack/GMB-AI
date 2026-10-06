"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass, Info, KeyRound, Loader2, Plus, Radar, RefreshCw, Search, X, Zap } from "lucide-react";
import { Card, Button, Input, Alert, Skeleton, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

/** Configure local search keywords: tracked list (plan slots) + AI smart recommendations. */
export function TrackedKeywords({ clientId, business }) {
  const { data, error, loading, reload, mutate } = useApi(`/api/gmb/${clientId}/tracked-keywords`);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const tracked = data?.tracked || [];
  const limit = data?.limit || 5;
  const left = Math.max(0, limit - tracked.length);
  const sugg = (data?.suggestions || []).filter((s) => !q || s.keyword.includes(q.toLowerCase()));

  async function add(keywords, key) {
    setBusy(key);
    setMsg(null);
    try {
      const r = await apiFetch(`/api/gmb/${clientId}/tracked-keywords`, { body: { action: "add", keywords } });
      if (r.skipped?.length) setMsg({ tone: "amber", text: `${r.added.length} added. Skipped: ${r.skipped.map((s) => `${s.keyword} (${s.reason})`).join(", ")}` });
      if (key === "custom") setText("");
      reload();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }
  async function remove(id) {
    mutate((d) => ({ ...d, tracked: d.tracked.filter((t) => t.id !== id) }));
    await apiFetch(`/api/gmb/${clientId}/tracked-keywords`, { body: { action: "remove", id } }).catch(() => {});
    reload();
  }

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden p-5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-violet-500 to-sky-500" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/30"><KeyRound className="h-5 w-5" /></span>
            <div>
              <p className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900 dark:text-white">Configure local search keywords {business ? <Badge>{business}</Badge> : null}</p>
              <p className="text-sm text-zinc-500">Target keywords to track this profile&apos;s rankings on Google Maps and Search. AI posts use them too.</p>
            </div>
          </div>
          {tracked.length ? (
            <Link href={`/rank-tracker?client=${clientId}&keywords=${encodeURIComponent(tracked.map((t) => t.keyword).join(", "))}`}>
              <Button variant="secondary"><Radar className="h-4 w-4" /> Rank-scan all {tracked.length}</Button>
            </Link>
          ) : null}
        </div>
      </Card>

      {error ? <Alert>{error}</Alert> : null}
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        {/* tracking list */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">Active tracking list <span className="font-normal text-zinc-400">({tracked.length}/{limit})</span></p>
            <Badge tone={left ? "violet" : "red"}>{left ? `${left} slot${left > 1 ? "s" : ""} remaining` : "Limit reached"}</Badge>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, (tracked.length / limit) * 100)}%` }} />
          </div>

          <p className="mb-1.5 mt-5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">Add custom keyword(s)</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) add(text, "custom"); }}>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. best dentist in rohini, dental clinic near me" disabled={!left} />
            <Button type="submit" disabled={!text.trim() || !left || busy === "custom"}>{busy === "custom" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add</Button>
          </form>
          <p className="mt-1 text-[11px] text-zinc-400">Tip: separate several keywords with commas to add them at once.</p>

          <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-zinc-500">Selected search targets ({tracked.length})</p>
          {loading && !data ? <Skeleton className="h-32" /> : tracked.length ? (
            <ul className="space-y-2">
              {tracked.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-600 dark:bg-brand-950/30">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.keyword}</span>
                  <Badge>{t.source === "CLIENT" ? "Custom" : t.source === "GMB" ? "Google" : "AI"}</Badge>
                  <button type="button" onClick={() => remove(t.id)} className="rounded-lg p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30" aria-label={`Remove ${t.keyword}`}><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center dark:border-zinc-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950/30"><Compass className="h-5 w-5" /></span>
              <p className="mt-2 text-sm font-semibold">No search keywords added yet</p>
              <p className="text-xs text-zinc-500">Click a suggestion on the right or type your own above.</p>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
            <span>Used by: rank grid, AI posts, reports</span>
            <span>Capacity: <b>{tracked.length}/{limit}</b></span>
          </div>
        </Card>

        {/* recommendations */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-600"><Zap className="h-4 w-4" /> AI smart recommendations</p>
            <div className="flex items-center gap-1">
              <Button variant="secondary" className="!px-2.5 !py-1 text-xs" disabled={!left || !sugg.length || busy === "top3"} onClick={() => add(sugg.slice(0, Math.min(3, left)).map((s) => s.keyword), "top3")}>
                {busy === "top3" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add top {Math.min(3, left) || 3}
              </Button>
              <button type="button" onClick={reload} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Hyper-local phrases built from this business&apos;s services, category, city and address landmarks - plus real Google search terms.</p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter recommended keywords…" className="pl-9" />
          </div>
          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {loading && !data ? <Skeleton className="h-60" /> : sugg.length ? sugg.map((s) => (
              <div key={s.keyword} className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.keyword}</p>
                  <p className="text-[11px] text-zinc-400">{s.reason}</p>
                </div>
                <button type="button" disabled={!left || busy === s.keyword} onClick={() => add([s.keyword], s.keyword)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40 dark:bg-violet-950/30 dark:text-violet-300">
                  {busy === s.keyword ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                </button>
              </div>
            )) : <p className="py-6 text-center text-xs text-zinc-400">No more suggestions - sync Google to import services and areas.</p>}
          </div>
          <p className="mt-3 flex items-center gap-1.5 border-t border-zinc-100 pt-3 text-[11px] text-zinc-400 dark:border-zinc-800"><Info className="h-3.5 w-3.5" /> Click any suggestion to add it to the tracking list instantly.</p>
        </Card>
      </div>
    </div>
  );
}
