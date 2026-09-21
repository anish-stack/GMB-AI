"use client";

import { useRouter } from "next/navigation";
import { LogOut, Play, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

export function Topbar({ session, aiProvider, gmbProvider, onMenuClick, creditsLeft = null }) {
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
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 bg-white/70 px-4 py-3 backdrop-blur-md md:px-5 dark:border-zinc-800/70 dark:bg-zinc-900/70">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 md:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
        <div className="hidden lg:block">
          <GlobalSearch />
        </div>
      </div>

      <div className="hidden items-center gap-2 text-xs text-zinc-500 xl:flex">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800 dark:text-zinc-400">AI: {aiProvider.name} / {aiProvider.textModel}</span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800 dark:text-zinc-400">GMB: {gmbProvider.name}{gmbProvider.isMock ? " (mock)" : ""}</span>
        {creditsLeft !== null ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            {creditsLeft} credits
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 md:gap-2">
        {msg ? <span className="hidden max-w-md truncate text-xs text-zinc-600 md:inline dark:text-zinc-400">{msg}</span> : null}
        <Button onClick={runNightly} disabled={running} className="hidden sm:inline-flex">
          <Play className="h-3.5 w-3.5" />
          {running ? "Running..." : "Run AI job"}
        </Button>
        <Button onClick={runNightly} disabled={running} className="sm:hidden !px-2.5" aria-label="Run AI job now">
          <Play className="h-3.5 w-3.5" />
        </Button>
        <ThemeToggle />
        <NotificationBell />
        <div className="hidden items-center gap-2 rounded-xl bg-zinc-50 px-3 py-1.5 ring-1 ring-zinc-100 sm:flex dark:bg-zinc-800/60 dark:ring-zinc-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-violet-500 text-xs font-semibold text-white">
            {(session.name || "?").charAt(0).toUpperCase()}
          </span>
          <div className="text-right">
            <p className="text-sm font-medium leading-tight text-zinc-800 dark:text-zinc-100">{session.name}</p>
            <p className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">{session.role}</p>
          </div>
        </div>
        <Button variant="ghost" onClick={logout} aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
