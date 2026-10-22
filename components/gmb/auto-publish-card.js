"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, Zap } from "lucide-react";
import { Card, Select, Alert } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

function Switch({ on, onClick, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-brand-500" : "bg-zinc-300 dark:bg-zinc-700"} disabled:opacity-50`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

const ago = (m) => (m == null ? null : m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`);

/** Post automation for one GMB: plan -> calendar -> AI writes -> auto-publish (QA >= threshold), with a health check. */
export function AutoPublishCard({ clientId }) {
  const { data, error, mutate } = useApi(`/api/clients/${clientId}/auto-publish`);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  async function save(patch, key) {
    setBusy(key);
    setErr("");
    try {
      mutate(await apiFetch(`/api/clients/${clientId}/auto-publish`, { method: "PUT", body: patch }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  if (!data) return error ? <Alert>{error}</Alert> : null;

  const sched = data.scheduler || {};
  const heartbeatOk = sched.heartbeat?.mins_ago != null && sched.heartbeat.mins_ago < 10;
  const planActive = data.plan?.status === "ACTIVE";
  const checks = [
    ...(data.paused ? [[false, "Auto-publishing is PAUSED by the platform admin - posts are still written, nothing goes to Google until it is resumed"]] : []),
    [heartbeatOk, heartbeatOk ? `Scheduler running (last beat ${ago(sched.heartbeat.mins_ago)})` : "Scheduler is NOT running - start it: pm2 start ecosystem.config.cjs --only hbs-scheduler"],
    [planActive, planActive ? `Posting plan active: ${data.plan.posts_per_week}/week until ${new Date(data.plan.end_date).toLocaleDateString("en-IN")}` : "No active posting plan - edit the client and set one"],
    [data.schedule_mode === "manual" ? false : data.auto_schedule, data.schedule_mode === "manual" ? "Admin set post automation to MANUAL - only calendar entries are written" : data.auto_schedule ? "Calendar is filled automatically from the plan" : "Auto-schedule is off - posts only come from the calendar you fill"],
    [Boolean(sched.nightly?.last_ok_at), sched.nightly?.last_ok_at ? `AI writing job last ran ${ago(sched.nightly.mins_ago)}` : "AI writing job hasn't run yet (runs nightly, or use Run AI job)"],
    [data.calendar_autopost !== false, data.calendar_autopost !== false ? `Calendar posts go live on Google at their time (default 05:00) - no approval needed${sched.calendar?.mins_ago != null ? ` · last run ${ago(sched.calendar.mins_ago)}` : ""}` : "Calendar auto-post is switched off by the platform admin - calendar posts wait for approval"],
    [data.enabled ? data.allowed : true, data.enabled ? (data.allowed ? `Posts made outside the calendar (Generate AI) also go live when QA is ${data.min_score}+` : `Auto-publish blocked: ${data.reason}`) : "Posts made outside the calendar (Generate AI) wait for you to publish"],
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/30"><Zap className="h-5 w-5" /></span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white">Post automation</p>
            <p className="text-xs text-zinc-500">Plan → calendar → AI writes the post → it goes live on Google at its time (default 05:00).</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 border-t border-zinc-100 p-4 sm:grid-cols-2 sm:p-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-sky-500" /> Auto-schedule from plan</p>
            <p className="text-xs text-zinc-500">Creates calendar posts on the plan&apos;s days at 05:00</p>
          </div>
          <Switch on={data.auto_schedule && data.schedule_mode !== "manual"} disabled={Boolean(busy) || data.schedule_mode === "manual"} onClick={() => save({ auto_schedule: !data.auto_schedule }, "sched")} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><Zap className="h-4 w-4 text-brand-500" /> Auto-publish other posts</p>
            <p className="text-xs text-zinc-500">Non-calendar posts scoring</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={data.min_score} disabled={Boolean(busy) || !data.enabled} onChange={(e) => save({ min_score: Number(e.target.value) }, "score")} className="!w-auto !py-1.5 text-xs" aria-label="Minimum QA score">
              {[80, 85, 90, 95].map((n) => <option key={n} value={n}>{n}+</option>)}
            </Select>
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : null}
            <Switch on={data.enabled} disabled={Boolean(busy) || (!data.allowed && !data.enabled)} onClick={() => save({ enabled: !data.enabled }, "pub")} />
          </div>
        </div>
      </div>
      <div className="border-t border-zinc-100 bg-zinc-50/60 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Automation check</p>
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {checks.map(([ok, text]) => (
            <li key={text} className={`flex items-start gap-2 ${ok ? "text-zinc-700 dark:text-zinc-200" : "text-amber-700 dark:text-amber-300"}`}>
              {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          {data.next ? <>Next scheduled post: <b>{new Date(data.next.scheduled_date).toLocaleDateString("en-IN")}{data.next.scheduled_time ? ` ${data.next.scheduled_time}` : ""}</b> · </> : null}
          {data.waiting} post(s) waiting for review · <Link href="/gmb/calendar" className="font-semibold text-brand-600 hover:underline">Open calendar</Link>
        </p>
        {err ? <Alert className="mt-3">{err}</Alert> : null}
      </div>
    </Card>
  );
}
