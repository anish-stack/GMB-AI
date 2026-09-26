"use client";

import { Field, Input } from "@/components/ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Mirrors lib/posting/plan.js approxTotal(): months x 4 weeks x posts/week. */
export const approxTotal = (months, perWeek) => Math.max(1, Math.round(Number(months || 0) * 4 * Number(perWeek || 0)));

export const emptyPlan = () => ({
  start_date: new Date().toLocaleDateString("en-CA"),
  duration_months: 1,
  posts_per_week: 3,
  total_posts: "",
  posting_days: [],
});

export function PostingPlanFields({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const computed = approxTotal(value.duration_months, value.posts_per_week);
  const days = value.posting_days || [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Plan start date">
          <Input type="date" value={value.start_date} onChange={(e) => set("start_date", e.target.value)} required />
        </Field>
        <Field label="Duration (months)">
          <Input type="number" min={1} max={60} value={value.duration_months} onChange={(e) => set("duration_months", e.target.value)} required />
        </Field>
        <Field label="Posts per week">
          <Input type="number" min={1} max={21} value={value.posts_per_week} onChange={(e) => set("posts_per_week", e.target.value)} required />
        </Field>
        <Field label="Total posts (optional)" hint={`Auto: ${computed}`}>
          <Input type="number" min={1} max={2000} value={value.total_posts} onChange={(e) => set("total_posts", e.target.value)} placeholder={String(computed)} />
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Posting days (optional - leave empty for any day)</p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d, i) => {
            const on = days.includes(i);
            return (
              <button key={d} type="button" onClick={() => set("posting_days", on ? days.filter((x) => x !== i) : [...days, i].sort())}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${on ? "bg-[#F53236] text-white ring-[#F53236]" : "text-zinc-600 ring-zinc-200 dark:text-zinc-300 dark:ring-zinc-700"}`}>
                {d}
              </button>
            );
          })}
        </div>
      </div>
      <p className="rounded-xl bg-zinc-50 px-3 py-2.5 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
        {value.duration_months || 0} month(s) × ~4 weeks × {value.posts_per_week || 0} posts/week ≈ <b>{computed} posts</b>
        {value.total_posts ? <> · capped at <b>{value.total_posts}</b></> : null}. Scheduling beyond the weekly or total limit is blocked.
      </p>
    </div>
  );
}
