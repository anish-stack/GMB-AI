"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Check, Copy, Loader2, Lock, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Input, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";
import { DAYS, norm } from "./helpers";

export function Section({ icon: Icon, title, description, action, locked, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 border-b border-zinc-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[#F53236] dark:bg-red-950/30">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
              {title}
              {locked ? <LockBadge /> : null}
            </h2>
            {description ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <fieldset disabled={locked} className="p-4 disabled:opacity-60 sm:p-5">{children}</fieldset>
    </section>
  );
}

export function LockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
      <Lock className="h-3 w-3" /> In Google review
    </span>
  );
}

export function Label({ children, hint, locked, className = "", right }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
        <span className="flex items-center gap-2">{children}{locked ? <LockBadge /> : null}</span>
        {right}
      </span>
      {hint ? <span className="mb-1.5 block text-[11px] text-zinc-400">{hint}</span> : null}
    </label>
  );
}

/* ---------------- weekly hours ---------------- */
export function HoursEditor({ hours, setHours }) {
  const set = (day, patch) => setHours((h) => ({ ...h, [day]: { ...h[day], ...patch } }));
  function copyMonday() {
    setHours((h) => Object.fromEntries(DAYS.map(([k]) => [k, k === "SUNDAY" ? h[k] : { ...h.MONDAY }])));
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={copyMonday} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-[#F53236] hover:underline">
        <Copy className="h-3.5 w-3.5" /> Copy Monday to Tue–Sat
      </button>
      {DAYS.map(([key, label]) => {
        const d = hours[key];
        return (
          <div key={key} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <label className="flex w-24 items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              <input type="checkbox" checked={d.enabled} onChange={() => set(key, { enabled: !d.enabled })} className="h-4 w-4 accent-[#F53236]" />
              {label}
            </label>
            {d.enabled ? (
              <>
                <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <input type="checkbox" checked={d.allDay} className="accent-[#F53236]"
                    onChange={() => set(key, d.allDay ? { allDay: false, open: "09:00", close: "18:00" } : { allDay: true, open: "00:00", close: "24:00" })} />
                  24h
                </label>
                {!d.allDay ? (
                  <div className="flex items-center gap-1.5">
                    <input type="time" value={d.open} onChange={(e) => set(key, { open: e.target.value })} aria-label={`${label} opens`}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                    <span className="text-zinc-400">–</span>
                    <input type="time" value={d.close === "24:00" ? "23:59" : d.close} onChange={(e) => set(key, { close: e.target.value })} aria-label={`${label} closes`}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                  </div>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-zinc-400">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- special / holiday hours ---------------- */
export function SpecialHoursEditor({ rows, setRows }) {
  const today = new Date().toISOString().slice(0, 10);
  const update = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <input type="date" min={today} value={r.date} onChange={(e) => update(i, { date: e.target.value })} aria-label="Date"
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input type="checkbox" checked={r.closed} onChange={() => update(i, { closed: !r.closed })} className="accent-[#F53236]" /> Closed
          </label>
          {!r.closed ? (
            <>
              <input type="time" value={r.open} onChange={(e) => update(i, { open: e.target.value })} aria-label="Opens"
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <input type="time" value={r.close} onChange={(e) => update(i, { close: e.target.value })} aria-label="Closes"
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            </>
          ) : null}
          <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label="Remove" className="ml-auto rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((r) => [...r, { date: "", closed: true, open: "10:00", close: "14:00" }])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-600 hover:border-[#F53236] hover:text-[#F53236] dark:border-zinc-700 dark:text-zinc-300">
        <CalendarPlus className="h-3.5 w-3.5" /> Add holiday / special day
      </button>
    </div>
  );
}

/* ---------------- secondary categories ---------------- */
export function CategoryPicker({ clientId, value, onChange }) {
  const [q, setQ] = useState("");
  const term = q.trim();
  const { data, loading } = useApi(term.length >= 2 ? `/api/gmb/${clientId}/categories?q=${encodeURIComponent(term)}` : null);
  const chosen = new Set(value.map((c) => c.id));
  const results = (data?.items || []).filter((c) => !chosen.has(c.id));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
            {c.name}
            <button type="button" onClick={() => onChange(value.filter((x) => x.id !== c.id))} aria-label={`Remove ${c.name}`}><X className="h-3 w-3" /></button>
          </span>
        ))}
        {!value.length ? <span className="text-xs text-zinc-400">No additional categories.</span> : null}
      </div>
      {value.length < 9 ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Google categories (e.g. dental clinic)" className="pl-9" />
          {term.length >= 2 ? (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {loading ? <p className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</p> : null}
              {!loading && !results.length ? <p className="px-3 py-2 text-xs text-zinc-400">No matches.</p> : null}
              {results.map((c) => (
                <button key={c.id} type="button" onClick={() => { onChange([...value, c]); setQ(""); }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- services ---------------- */
export function ServicesEditor({ clientId, services, setServices }) {
  const { data, loading, error, reload } = useApi(`/api/gmb/${clientId}/service-types`);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const types = useMemo(() => (data?.serviceTypes || []).filter((t) => t?.serviceTypeId && t?.displayName), [data]);
  const byId = useMemo(() => new Map(types.map((t) => [t.serviceTypeId, t.displayName])), [types]);
  // saved ids ("job_type_id:x") shown as names - derived, no effect needed
  const shown = useMemo(() => services.map((s) => byId.get(s) || s), [services, byId]);
  const selected = useMemo(() => new Set(shown.map(norm)), [shown]);
  const filtered = useMemo(() => (q ? types.filter((t) => norm(t.displayName).includes(norm(q))) : types), [types, q]);

  const commit = (list) => setServices(list.map((s) => byId.get(s) || s));
  function add(raw = input) {
    const v = String(raw).trim();
    if (!v || selected.has(norm(v))) return setInput("");
    const official = types.find((t) => norm(t.displayName) === norm(v));
    commit([...shown, official ? official.displayName : v]);
    setInput("");
  }
  const toggle = (name) => commit(selected.has(norm(name)) ? shown.filter((s) => norm(s) !== norm(name)) : [...shown, name]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add a custom service and press Enter"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={() => add()} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-zinc-900 px-3 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.length ? shown.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
            {s}
            <button type="button" onClick={() => toggle(s)} aria-label={`Remove ${s}`}><X className="h-3 w-3" /></button>
          </span>
        )) : <span className="text-xs text-zinc-400">No services yet.</span>}
      </div>

      {loading ? <Skeleton className="h-24" /> : null}
      {error ? (
        <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
          Suggested services unavailable: {error}
          <button type="button" onClick={reload} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="h-3 w-3" /> Retry</button>
        </p>
      ) : null}
      {types.length ? (
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              Google-suggested for {data?.category?.name || "this category"} ({types.filter((t) => selected.has(norm(t.displayName))).length}/{types.length})
            </p>
            {types.length > 10 ? <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="!w-40 !py-1 text-xs" /> : null}
          </div>
          <div className="flex max-h-60 flex-wrap gap-1.5 overflow-y-auto">
            {filtered.map((t) => {
              const on = selected.has(norm(t.displayName));
              return (
                <button key={t.serviceTypeId} type="button" onClick={() => toggle(t.displayName)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${on ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50 dark:text-zinc-300 dark:ring-zinc-700"}`}>
                  {on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {t.displayName}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
