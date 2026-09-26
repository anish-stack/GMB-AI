"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, MapPin, CalendarDays, ListChecks,
  KeyRound, Bot, BarChart3, Settings, Sparkles, X, CreditCard, UsersRound, Bell, FileText, LifeBuoy, Code2, Inbox, ShieldAlert, Radar,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gmb/tasks", label: "Review queue", icon: ListChecks },
  { href: "/gmb/calendar", label: "Content calendar", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/gmb", label: "GMB profiles", icon: MapPin },
  { href: "/keywords", label: "Keywords", icon: KeyRound },
  { href: "/ai-runs", label: "AI runs", icon: Bot },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/reviews", label: "Review inbox", icon: Inbox },
  { href: "/listing-health", label: "Listing health", icon: ShieldAlert },
  { href: "/rank-tracker", label: "Rank tracker", icon: Radar },
  { href: "/reports", label: "Shared reports", icon: FileText },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/developers", label: "API & developers", icon: Code2, perm: "billing.view" },
  { href: "/team", label: "Team", icon: UsersRound, perm: "team.view" },
  { href: "/billing", label: "Billing & plan", icon: CreditCard, perm: "billing.view" },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavList({ pathname, onNavigate, perms = [] }) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
      {NAV.filter((n) => !n.perm || perms.includes(n.perm)).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-50 text-[#e81d22] ring-1 ring-inset ring-[#e81d22] dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-500/20"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            )}
          >
            <Icon className={cn("h-4 w-4", active ? "text-[#F53236] dark:text-brand-400" : "text-zinc-400")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ trailing, workspace, plan }) {
  return (
    <div className="flex items-center justify-between gap-2.5 px-5 py-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/30">
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </span>
        <div>
          <p className="max-w-36 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{workspace || "GMB AI Cloud"}</p>
          <p className="text-[11px] text-zinc-400">{plan ? `${plan} plan` : "Workspace"}</p>
        </div>
      </div>
      {trailing}
    </div>
  );
}

function FooterNote({ gmbMock, creditsLeft }) {
  return (
    <p className="mx-3 mb-4 rounded-xl bg-zinc-50 px-3 py-3 text-[11px] leading-relaxed text-zinc-500 ring-1 ring-zinc-100 dark:bg-zinc-800/60 dark:text-zinc-400 dark:ring-zinc-800">
      {creditsLeft !== null ? <span className="block font-medium">{creditsLeft} AI credits left this cycle.</span> : null}
      {gmbMock ? "Mock GMB mode - nothing is sent to Google." : "Connected listings publish live to Google."}
    </p>
  );
}

export function Sidebar({ mobileOpen = false, onClose, workspace, plan, perms = [], creditsLeft = null, gmbMock = true }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen, onClose]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200/70 bg-white/80 backdrop-blur-md md:flex dark:border-zinc-800/70 dark:bg-zinc-900/80">
        <Brand workspace={workspace} plan={plan} />
        <NavList pathname={pathname} perms={perms} />
        <FooterNote gmbMock={gmbMock} creditsLeft={creditsLeft} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose} />
          <aside className="page-enter absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-2xl dark:bg-zinc-900">
            <Brand
              workspace={workspace}
              plan={plan}
              trailing={
                <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="h-4 w-4" />
                </button>
              }
            />
            <NavList pathname={pathname} onNavigate={onClose} perms={perms} />
            <FooterNote gmbMock={gmbMock} creditsLeft={creditsLeft} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
