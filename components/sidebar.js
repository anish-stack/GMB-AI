"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, MapPin, CalendarDays, ListChecks,
  KeyRound, Bot, BarChart3, Settings, Sparkles,
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
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900 md:flex">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600">
          <Sparkles className="h-4 w-4 text-white" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">GMB AI Manager</p>
          <p className="text-[11px] text-slate-400">Internal SEO tool</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="px-4 py-3 text-[11px] leading-relaxed text-slate-500">
        Publishing runs on the mock GMB provider. Nothing is sent to Google.
      </p>
    </aside>
  );
}
