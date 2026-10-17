"use client";

import { useApi } from "@/lib/hooks/use-api";

/** Small select of admin-managed image styles. value "" = profile's own style. */
export function ImageStylePicker({ value, onChange, label = "Image style for this generation" }) {
  const { data } = useApi("/api/image-styles");
  const items = data?.items || [];
  if (items.length < 2) return null;
  return (
    <label className="block text-[11px] font-semibold text-zinc-500">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-normal text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        <option value="">Profile default</option>
        {items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  );
}
