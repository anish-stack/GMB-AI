"use client";

import Link from "next/link";
import { ChevronRight, Plus, Wrench } from "lucide-react";
import { Card, Button, Alert, Skeleton, EmptyState, PanelHeader, Badge } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";

export const priceLabel = (p) => (p === null || p === undefined || p === "" ? "No price" : Number(p) === 0 ? "Free" : `₹${Number(p).toLocaleString("en-IN")}`);

/** Services tab: grouped list. Add / edit open their own pages. */
export function ServicesPanel({ clientId }) {
  const { data, error, loading } = useApi(`/api/gmb/${clientId}/services`);
  const cats = data?.categories || [];
  const items = (data?.items || []).map((it, i) => ({ ...it, _i: i }));
  return (
    <Card className="overflow-hidden">
      <PanelHeader icon={Wrench} tone="blue" title="Services" subtitle={`${items.length} service(s) on Google, grouped by business category`}
        actions={<Link href={`/gmb/${clientId}/services/new`}><Button><Plus className="h-4 w-4" /> Add service</Button></Link>} />
      <div className="space-y-5 p-4 sm:p-5">
        {error ? <Alert>{error}</Alert> : null}
        {loading && !data ? <Skeleton className="h-48" /> : !cats.length ? <EmptyState icon={Wrench} title="No categories" text="Connect and sync Google first." /> : cats.map((c) => {
          const inCat = items.filter((i) => i.category === c.id || (!i.category && c.primary));
          return (
            <section key={c.id} className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3 bg-zinc-50/70 px-4 py-3 dark:bg-zinc-900/60">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-zinc-500">{c.primary ? "Primary category" : "Additional category"} · {inCat.length} service(s)</p>
                </div>
                <Link href={`/gmb/${clientId}/services/new?category=${encodeURIComponent(c.id)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"><Plus className="h-3.5 w-3.5" /> Add</Link>
              </div>
              {inCat.length ? (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {inCat.map((i) => (
                    <li key={i._i}>
                      <Link href={`/gmb/${clientId}/services/${i._i}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{i.name}</p>
                          <p className="truncate text-xs text-zinc-400">{i.description || "No description - add one to help customers and ranking"}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge tone={i.price === null || i.price === undefined ? "slate" : "emerald"}>{priceLabel(i.price)}</Badge>
                          <ChevronRight className="h-4 w-4 text-zinc-400" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="px-4 py-4 text-sm text-zinc-400">No services in this category yet.</p>}
            </section>
          );
        })}
      </div>
    </Card>
  );
}
