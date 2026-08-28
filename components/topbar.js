"use client";

import { useRouter } from "next/navigation";
import { LogOut, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";

export function Topbar({ session, aiProvider, gmbProvider }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");

  async function runNightly() {
    setRunning(true);
    setMsg("");
    try {
      const res = await fetch("/api/ai/nightly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10) }),
      });
      const data = await res.json();
      setMsg(
        data.error
          ? data.error
          : `${data.generated}/${data.scheduled} generated - ${data.ready} ready, ${data.needsReview} need review, ${data.failed} failed`
      );
      router.refresh();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setRunning(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="rounded bg-slate-100 px-2 py-1">AI: {aiProvider.name} / {aiProvider.textModel}</span>
        <span className="rounded bg-slate-100 px-2 py-1">GMB: {gmbProvider.name}{gmbProvider.isMock ? " (mock)" : ""}</span>
      </div>
      <div className="flex items-center gap-3">
        {msg ? <span className="max-w-md truncate text-xs text-slate-600">{msg}</span> : null}
        <Button onClick={runNightly} disabled={running}>
          <Play className="h-3.5 w-3.5" />
          {running ? "Running AI job..." : "Run AI job now"}
        </Button>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-800">{session.name}</p>
          <p className="text-[11px] text-slate-500">{session.role}</p>
        </div>
        <Button variant="ghost" onClick={logout} aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
