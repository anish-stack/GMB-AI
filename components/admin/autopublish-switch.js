"use client";

import { useState } from "react";
import { PauseCircle, PlayCircle, Radio } from "lucide-react";
import { Card, Button, Alert } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

/** Super admin master switch: stop / resume every automatic post to Google. */
export function AutoPublishSwitch() {
  const { data, error, mutate } = useApi("/api/admin/autopublish");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return null;
  const paused = Boolean(data.paused);

  async function toggle() {
    const next = !paused;
    const ask = next
      ? "Pause ALL automatic publishing to Google for every tenant?\n\nPosts are still written by AI, but nothing goes live until you resume."
      : "Resume automatic publishing?\n\nPosts whose time passed during the pause will NOT be published automatically - they stay in the review queue.";
    if (!window.confirm(ask)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiFetch("/api/admin/autopublish", { method: "POST", body: { paused: next } });
      mutate(r);
      setMsg(next ? "Auto-publishing paused." : "Auto-publishing resumed.");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={paused ? "ring-2 ring-red-400" : "ring-1 ring-emerald-300/60"}>
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${paused ? "bg-red-50 text-red-600 dark:bg-red-950/30" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"}`}>
            {paused ? <PauseCircle className="h-5 w-5" /> : <Radio className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white">
              Auto-publish to Google: <span className={paused ? "text-red-600" : "text-emerald-600"}>{paused ? "OFF (paused)" : "ON"}</span>
            </p>
            <p className="text-xs text-zinc-500">
              {paused
                ? `Paused${data.pausedAt ? ` since ${new Date(data.pausedAt).toLocaleString("en-IN")}` : ""}${data.pausedBy ? ` by ${data.pausedBy}` : ""}. AI still writes posts; nothing is published automatically.`
                : `Calendar posts and approved posts go live at their time for every tenant. ${data.upcoming || 0} calendar post(s) waiting.`}
            </p>
            {msg ? <p className="mt-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">{msg}</p> : null}
          </div>
        </div>
        <Button variant={paused ? "primary" : "danger"} onClick={toggle} disabled={busy}>
          {paused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
          {busy ? "..." : paused ? "Turn auto-publish ON" : "Turn auto-publish OFF"}
        </Button>
      </div>
    </Card>
  );
}
