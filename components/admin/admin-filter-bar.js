"use client";

import { useState, useTransition, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, RotateCcw, Bookmark, X, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Build a URL with updated params (empty values removed, page reset unless told otherwise). */
function useQueryNav() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function push(patch, { keepPage = false } = {}) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v == null) next.delete(k);
      else next.set(k, String(v));
    }
    if (!keepPage) next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  function reset() {
    startTransition(() => router.push(pathname, { scroll: false }));
  }
  return { sp, push, reset, pending, pathname, router, startTransition };
}

/**
 * fields: [{ name, label, type: "text"|"select"|"date"|"number", options?: [{value,label}], placeholder?, advanced?, className? }]
 * storageKey: localStorage key for saved views
 */
/* Saved filter views in localStorage (hydration-safe). */
const VIEWS_EVENT = "admin-filter-views";
const EMPTY_VIEWS = "[]";
function subscribeViews(cb) {
  window.addEventListener("storage", cb);
  window.addEventListener(VIEWS_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(VIEWS_EVENT, cb);
  };
}
function useSavedViews(storageKey) {
  const raw = useSyncExternalStore(
    subscribeViews,
    () => {
      try {
        return localStorage.getItem(storageKey) || EMPTY_VIEWS;
      } catch {
        return EMPTY_VIEWS;
      }
    },
    () => EMPTY_VIEWS
  );
  let views = [];
  try {
    views = JSON.parse(raw);
  } catch {}
  function persist(list) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch {}
    window.dispatchEvent(new Event(VIEWS_EVENT));
  }
  return [views, persist];
}

export function AdminFilterBar(props) {
  const sp = useSearchParams();
  // Remount on URL change so the draft always starts from the current filters.
  return <FilterBarInner key={sp.toString()} {...props} />;
}

function FilterBarInner({ fields, storageKey }) {
  const { sp, push, reset, pending, pathname, router, startTransition } = useQueryNav();
  const [draft, setDraft] = useState(() => Object.fromEntries(fields.map((f) => [f.name, sp.get(f.name) || ""])));
  const [showAdv, setShowAdv] = useState(() => fields.some((f) => f.advanced && sp.get(f.name)));
  const [views, persist] = useSavedViews(storageKey);

  function change(f, value) {
    setDraft((d) => ({ ...d, [f.name]: value }));
    if (f.type !== "text" && f.type !== "number") push({ [f.name]: value });
  }

  function apply(e) {
    e?.preventDefault();
    push(draft);
  }

  function saveView() {
    const qs = sp.toString();
    if (!qs) return;
    const name = window.prompt("Name this filter view");
    if (!name) return;
    persist([...views.filter((v) => v.name !== name), { name, qs }]);
  }

  const active = fields.filter((f) => sp.get(f.name));
  const main = fields.filter((f) => !f.advanced);
  const adv = fields.filter((f) => f.advanced);

  function control(f) {
    const common = { value: draft[f.name] ?? "", className: cn("!py-1.5", f.className) };
    if (f.type === "select") {
      return (
        <Select {...common} onChange={(e) => change(f, e.target.value)}>
          <option value="">{f.allLabel || `All ${f.label.toLowerCase()}`}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      );
    }
    return (
      <Input
        {...common}
        type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
        step={f.step}
        min={f.min}
        max={f.max}
        placeholder={f.placeholder || f.label}
        onChange={(e) => change(f, e.target.value)}
      />
    );
  }

  return (
    <form onSubmit={apply} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        {main.map((f) => (
          <label key={f.name} className={cn("block", f.type === "text" ? "min-w-56 flex-1" : "w-40")}>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">{f.label}</span>
            {control(f)}
          </label>
        ))}
        <div className="flex items-center gap-1.5">
          <Button type="submit" className="!py-1.5" disabled={pending}>
            <Search className="h-3.5 w-3.5" /> {pending ? "..." : "Apply"}
          </Button>
          {adv.length ? (
            <Button type="button" variant="secondary" className="!py-1.5" onClick={() => setShowAdv((s) => !s)}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> More
            </Button>
          ) : null}
          <Button type="button" variant="ghost" className="!py-1.5" onClick={reset} title="Reset filters">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" className="!py-1.5" onClick={saveView} title="Save this filter view" disabled={!sp.toString()}>
            <Bookmark className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {showAdv && adv.length ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
          {adv.map((f) => (
            <label key={f.name} className={cn("block", f.type === "text" ? "min-w-48 flex-1" : "w-40")}>
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">{f.label}</span>
              {control(f)}
            </label>
          ))}
        </div>
      ) : null}

      {views.length || active.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {views.map((v) => (
            <span key={v.name} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
              <button type="button" onClick={() => startTransition(() => router.push(`${pathname}?${v.qs}`, { scroll: false }))}>
                {v.name}
              </button>
              <button type="button" onClick={() => persist(views.filter((x) => x.name !== v.name))} aria-label="Delete view">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {active.map((f) => {
            const raw = sp.get(f.name);
            const label = f.options?.find((o) => String(o.value) === raw)?.label || raw;
            return (
              <span key={f.name} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
                {f.label}: <b className="font-medium">{label}</b>
                <button type="button" onClick={() => push({ [f.name]: "" })} aria-label={`Clear ${f.label}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
    </form>
  );
}

/** Clickable count chips (e.g. status) that set one URL param. */
export function CountChips({ param, counts, tones = {}, allLabel = "All" }) {
  const { sp, push } = useQueryNav();
  const current = sp.get(param) || "";
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const chip = (value, label, n) => (
    <button
      key={value || "_all"}
      type="button"
      onClick={() => push({ [param]: value })}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
        current === value
          ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"
          : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700",
        current !== value && tones[value]
      )}
    >
      {label} <span className="opacity-70">{n}</span>
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {chip("", allLabel, total)}
      {entries.map(([k, n]) => chip(k, k.replaceAll("_", " "), n))}
    </div>
  );
}

/** Sort + per-page + pagination row. */
export function ListFooter({ total, page, perPage, sorts }) {
  const { sp, push } = useQueryNav();
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(total, page * perPage);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-zinc-500">
      <div className="flex items-center gap-2">
        {sorts ? (
          <Select value={sp.get("sort") || sorts[0].value} onChange={(e) => push({ sort: e.target.value })} className="!w-44 !py-1 !text-xs">
            {sorts.map((s) => <option key={s.value} value={s.value}>Sort: {s.label}</option>)}
          </Select>
        ) : null}
        <Select value={String(perPage)} onChange={(e) => push({ per: e.target.value })} className="!w-24 !py-1 !text-xs">
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span>{from}-{to} of {total}</span>
        <Button type="button" variant="secondary" className="!px-2 !py-1" disabled={page <= 1} onClick={() => push({ page: page - 1 }, { keepPage: true })}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span>{page} / {pages}</span>
        <Button type="button" variant="secondary" className="!px-2 !py-1" disabled={page >= pages} onClick={() => push({ page: page + 1 }, { keepPage: true })}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
