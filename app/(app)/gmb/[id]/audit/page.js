import { requirePagePermission } from "@/lib/saas/context.js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, MapPin, Star, Image as ImageIcon, Tag, ExternalLink } from "lucide-react";
import { requireTenantContext } from "@/lib/saas/context.js";
import { one } from "@/lib/db";
import { runAudit } from "@/lib/gmb/audit.js";
import { Card, Badge } from "@/components/ui";
import { AuditRerun } from "@/components/gmb/audit-rerun";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile audit" };

const ICON = { ok: [CheckCircle2, "text-emerald-500"], warn: [AlertTriangle, "text-amber-500"], fail: [XCircle, "text-rose-500"] };
const ring = (s) => (s >= 80 ? "#10b981" : s >= 60 ? "#f59e0b" : "#f43f5e");

export default async function AuditPage({ params }) {
  await requirePagePermission("gmb.view");
  const ctx = await requireTenantContext();
  const { id } = await params;
  const c = await one("SELECT id FROM clients WHERE id=? AND tenant_id=?", [Number(id), ctx.tenantId]);
  if (!c) notFound();
  const a = await runAudit(c.id);
  const s = a.summary;
  const C = 2 * Math.PI * 52;
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/gmb/${c.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> {s.name}</Link>
          <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">Google Business Profile audit</h1>
          <p className="text-sm text-zinc-500">{a.sections.reduce((n, x) => n + x.checks.length, 0)} checks · {new Date(a.ran_at).toLocaleString("en-IN")}{s.mock ? " · demo data" : ""}</p>
        </div>
        <AuditRerun />
      </div>

      <Card className="p-5">
        <div className="grid items-center gap-6 md:grid-cols-[150px_1fr]">
          <div className="relative mx-auto h-[130px] w-[130px]">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10" className="text-zinc-100 dark:text-zinc-800" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={ring(a.score)} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - a.score / 100)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-zinc-900 dark:text-white">{a.score}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">/ 100</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {s.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-zinc-200" />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{s.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-zinc-500"><MapPin className="h-3 w-3 shrink-0" />{s.address || "-"}</p>
              </div>
              {s.maps_url ? <a href={s.maps_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Maps <ExternalLink className="h-3 w-3" /></a> : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {[[Star, "Google rating", s.rating ? `${s.rating} / 5` : "-"], [Star, "Total reviews", s.reviews], [ImageIcon, "Profile photos", s.photos], [Tag, "Primary category", s.category || "-"]].map(([I, k, v]) => (
                <div key={k} className="rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{k}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold"><I className="h-3.5 w-3.5 shrink-0 text-amber-500" />{v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="emerald">{a.counts.ok} passed</Badge><Badge tone="amber">{a.counts.warn} to improve</Badge><Badge tone="red">{a.counts.fail} failing</Badge>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {a.sections.map((x) => (
          <a key={x.name} href={`#${x.name.replace(/\W+/g, "-")}`} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold hover:border-brand-400 dark:border-zinc-700 dark:bg-zinc-900">
            {x.name} <span style={{ color: ring(x.score) }}>{x.score}%</span>
          </a>
        ))}
      </div>

      {a.sections.map((x) => (
        <Card key={x.name} id={x.name.replace(/\W+/g, "-")} className="scroll-mt-20 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
            <p className="font-bold text-zinc-900 dark:text-white">{x.name}</p>
            <span className="text-sm font-bold" style={{ color: ring(x.score) }}>{x.score}%</span>
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {x.checks.map((ch) => {
              const [I, cls] = ICON[ch.status];
              return (
                <li key={ch.id} className="flex items-start gap-3 px-5 py-3.5">
                  <I className={`mt-0.5 h-5 w-5 shrink-0 ${cls}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{ch.title}</p>
                    <p className="text-xs leading-5 text-zinc-500">{ch.detail}</p>
                  </div>
                  {ch.fix && ch.status !== "ok" ? <Link href={ch.fix} className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">Fix</Link> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
