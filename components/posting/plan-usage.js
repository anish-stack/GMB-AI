"use client";

import { useState } from "react";
import { CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { Card, Button, Alert, Skeleton } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { PostingPlanFields, emptyPlan } from "./plan-fields";

function Bar({ value, max, tone = "bg-[#F53236]" }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const STATE = {
  ACTIVE: ["Active", "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"],
  EXPIRED: ["Expired", "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"],
  NOT_STARTED: ["Starts soon", "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300"],
  NO_PLAN: ["No plan", "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"],
};

export function usePlanUsage(clientId) {
  return useApi(clientId ? `/api/clients/${clientId}/posting-plan` : null);
}

/** Compact counters - used in the calendar add dialog. */
export function PlanUsageInline({ usage }) {
  if (!usage) return null;
  if (!usage.plan) return <Alert tone="amber">No posting plan for this client{usage.required ? " - scheduling is blocked until one is set." : "."}</Alert>;
  return (
    <div className="space-y-2 rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-800/60">
      <div className="flex justify-between"><span>This week ({usage.week.start} → {usage.week.end})</span><b>{usage.week.used}/{usage.week.limit}</b></div>
      <Bar value={usage.week.used} max={usage.week.limit} tone="bg-violet-500" />
      <div className="flex justify-between"><span>Plan total</span><b>{usage.used}/{usage.total}</b></div>
      <Bar value={usage.used} max={usage.total} />
      {usage.state === "EXPIRED" ? <p className="font-semibold text-rose-600">Plan expired on {usage.plan.end_date}.</p> : null}
    </div>
  );
}

/** Full card with counters + edit / extend (client page). */
export function PostingPlanCard({ clientId, canEdit = true }) {
  const { data, error, loading, reload } = usePlanUsage(clientId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);

  async function run(kind, fn) {
    setBusy(kind);
    setMsg(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }

  const u = data;
  const [label, cls] = STATE[u?.state || "NO_PLAN"];
  const openEdit = () => {
    setForm(u?.plan ? { start_date: u.plan.start_date, duration_months: u.plan.duration_months, posts_per_week: u.plan.posts_per_week, total_posts: u.plan.total_posts, posting_days: u.plan.posting_days || [] } : emptyPlan());
    setEditing(true);
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
          <CalendarClock className="h-4 w-4 text-[#F53236]" /> Posting plan
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
        </h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reload} aria-label="Refresh">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
          {canEdit && u?.plan ? (
            <Button variant="secondary" disabled={busy === "extend"} onClick={() => run("extend", () => apiFetch(`/api/clients/${clientId}/posting-plan`, { body: { action: "extend", months: 1 } }))}>
              {busy === "extend" ? "Extending…" : "Extend +1 month"}
            </Button>
          ) : null}
          {canEdit ? <Button onClick={openEdit}>{u?.plan ? "Change plan" : "Set plan"}</Button> : null}
        </div>
      </div>
      <div className="space-y-4 p-5">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        {loading && !u ? <Skeleton className="h-28" /> : null}
        {u && !u.plan && !editing ? (
          <Alert tone="amber">No posting plan yet. {u.required ? "Scheduling and AI generation are blocked until you set one." : ""}</Alert>
        ) : null}
        {u?.plan && !editing ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Total plan posts", u.total],
                ["Published", u.counts.published],
                ["Scheduled", u.counts.scheduled],
                ["Pending / in progress", u.counts.pending + u.counts.processing],
                ["Remaining", u.remaining],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
                  <p className="text-[11px] text-zinc-500">{k}</p>
                  <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{v}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex justify-between text-xs"><span className="text-zinc-500">Plan usage</span><b>{u.used}/{u.total}</b></div>
                <Bar value={u.used} max={u.total} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-zinc-500">Week {u.week.index} ({u.week.start} → {u.week.end}) · limit {u.week.limit}</span>
                  <b>{u.week.used} used · {u.week.remaining} left</b>
                </div>
                <Bar value={u.week.used} max={u.week.limit} tone="bg-violet-500" />
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              {u.plan.start_date} → {u.plan.end_date} · {u.plan.duration_months} month(s) · {u.plan.posts_per_week}/week
              {u.plan.posting_days?.length ? ` · days: ${u.plan.posting_days.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}` : ""}
              {u.state === "ACTIVE" ? ` · ${u.daysLeft} day(s) left` : ""}
            </p>
            {u.state === "EXPIRED" ? <Alert>Plan expired - automatic posting and new scheduling are stopped. Published posts stay live. Extend or change the plan to continue.</Alert> : null}
          </>
        ) : null}
        {editing && form ? (
          <div className="space-y-4">
            <PostingPlanFields value={form} onChange={setForm} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button disabled={busy === "save"} onClick={() => run("save", async () => { await apiFetch(`/api/clients/${clientId}/posting-plan`, { method: "PUT", body: form }); setEditing(false); })}>
                {busy === "save" ? "Saving…" : "Save plan"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
