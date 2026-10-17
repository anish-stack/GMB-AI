"use client";

import { Check, RotateCcw } from "lucide-react";
import { PERMISSION_GROUPS, DEFAULT_MEMBER_PERMISSIONS, ALL_TENANT_PERMISSIONS } from "@/lib/saas/constants.js";

/** Checkbox grid of every workspace permission, grouped. value = array of permission keys. */
export function PermissionChecklist({ value, onChange, disabled = false }) {
  const set = new Set(value);
  const toggle = (k) => {
    const next = new Set(set);
    if (next.has(k)) next.delete(k);
    else {
      next.add(k);
      // anything you can edit you must be able to see
      const view = `${k.split(".")[0]}.view`;
      if (ALL_TENANT_PERMISSIONS.includes(view)) next.add(view);
    }
    onChange(ALL_TENANT_PERMISSIONS.filter((p) => next.has(p)));
  };
  const toggleGroup = (g, on) => {
    const next = new Set(set);
    for (const [k] of g.perms) (on ? next.add(k) : next.delete(k));
    onChange(ALL_TENANT_PERMISSIONS.filter((p) => next.has(p)));
  };
  const isDefault = value.length === DEFAULT_MEMBER_PERMISSIONS.length && DEFAULT_MEMBER_PERMISSIONS.every((p) => set.has(p));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" disabled={disabled} onClick={() => onChange([...ALL_TENANT_PERMISSIONS])} className="rounded-lg border border-zinc-200 px-2.5 py-1 font-semibold hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Select all</button>
        <button type="button" disabled={disabled} onClick={() => onChange([...DEFAULT_MEMBER_PERMISSIONS])} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 font-semibold hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"><RotateCcw className="h-3 w-3" /> Default (all except billing & settings)</button>
        <button type="button" disabled={disabled} onClick={() => onChange(["client.view", "task.view", "calendar.view", "keyword.view", "gmb.view", "analytics.view"])} className="rounded-lg border border-zinc-200 px-2.5 py-1 font-semibold hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">View only</button>
        <span className="ml-auto text-zinc-500">{value.length}/{ALL_TENANT_PERMISSIONS.length} enabled{isDefault ? " · default" : ""}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PERMISSION_GROUPS.map((g) => {
          const on = g.perms.filter(([k]) => set.has(k)).length;
          const all = on === g.perms.length;
          return (
            <div key={g.id} className={`rounded-xl border p-3 ${g.id === "billing" || g.id === "settings" ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10" : "border-zinc-200 dark:border-zinc-800"}`}>
              <label className="mb-2 flex cursor-pointer items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-white">{g.label}</span>
                <span className="flex items-center gap-2 text-[11px] text-zinc-500">
                  {on}/{g.perms.length}
                  <input type="checkbox" className="h-4 w-4 accent-brand-500" disabled={disabled} checked={all} ref={(el) => { if (el) el.indeterminate = on > 0 && !all; }} onChange={(e) => toggleGroup(g, e.target.checked)} aria-label={`All ${g.label}`} />
                </span>
              </label>
              <ul className="space-y-1.5">
                {g.perms.map(([k, label]) => (
                  <li key={k}>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${set.has(k) ? "border-brand-500 bg-brand-500 text-white" : "border-zinc-300 dark:border-zinc-600"}`}>
                        {set.has(k) ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <input type="checkbox" className="sr-only" disabled={disabled} checked={set.has(k)} onChange={() => toggle(k)} />
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const parsePerms = (p, role) => {
  if (role === "OWNER") return [...ALL_TENANT_PERMISSIONS];
  if (Array.isArray(p)) return p;
  try {
    const v = typeof p === "string" ? JSON.parse(p) : null;
    return Array.isArray(v) ? v : [...DEFAULT_MEMBER_PERMISSIONS];
  } catch {
    return [...DEFAULT_MEMBER_PERMISSIONS];
  }
};
