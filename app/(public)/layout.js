import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getSettings } from "@/lib/saas/settings.js";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }) {
  const settings = await getSettings();
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/pricing" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F53236]">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{settings.platform_name}</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/pricing" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300">Pricing</Link>
            <Link href="/login" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300">Sign in</Link>
            {Number(settings.allow_signup) === 1 ? (
              <Link href="/signup" className="rounded-xl bg-[#F53236] px-3.5 py-2 font-medium text-white hover:bg-[#e81d22]">
                Start free
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-zinc-400">
        {settings.platform_name} · {settings.support_email}
      </footer>
    </div>
  );
}
