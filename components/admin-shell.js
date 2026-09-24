"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Layers, CreditCard, Receipt, Coins, TicketPercent,
  Activity, ScrollText, UsersRound, Settings, ShieldCheck, LogOut, Menu, X, Send, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/plans", label: "Plans", icon: Layers },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/invoices", label: "Invoices", icon: Receipt },
  { href: "/admin/credits", label: "Credits", icon: Coins },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/gmb-posts", label: "GMB postings", icon: Send },
  { href: "/admin/gmb-profiles", label: "GMB profiles", icon: MapPin },
  { href: "/admin/usage", label: "Platform usage", icon: Activity },
  { href: "/admin/users", label: "Users", icon: UsersRound },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function Nav({ pathname, onNavigate }) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ session, platformName, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const brand = (
    <div className="flex items-center justify-between gap-2 px-5 py-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-900 dark:bg-zinc-100">
          <ShieldCheck className="h-4.5 w-4.5 text-white dark:text-zinc-900" />
        </span>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{platformName}</p>
          <p className="text-[11px] text-zinc-400">Super admin console</p>
        </div>
      </div>
      <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-zinc-400 md:hidden">
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200/70 bg-white/80 backdrop-blur-md md:flex dark:border-zinc-800/70 dark:bg-zinc-900/80">
        {brand}
        <Nav pathname={pathname} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-zinc-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-2xl dark:bg-zinc-900">
            {brand}
            <Nav pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200/70 bg-white/70 px-4 py-3 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-xl p-2 text-zinc-500 md:hidden">
              <Menu className="h-4.5 w-4.5" />
            </button>
            <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              Platform owner
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-zinc-800 dark:text-zinc-100">{session.name}</p>
              <p className="text-[11px] leading-tight text-zinc-500">{session.email}</p>
            </div>
            <Button variant="ghost" onClick={logout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
