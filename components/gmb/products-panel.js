"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Package, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Card, Button, Alert, Skeleton, EmptyState, PanelHeader } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

export const money = (v) => (v === null || v === undefined || v === "" ? "" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

/** Products tab: catalog grid. Add / edit open their own pages. */
export function ProductsPanel({ clientId }) {
  const { data, error, loading, reload } = useApi(`/api/gmb/${clientId}/products`);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const items = data?.items || [];
  async function act(id, fn, ok) {
    setBusy(id);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ tone: "green", text: typeof ok === "function" ? ok(r) : ok });
      reload();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card className="overflow-hidden">
      <PanelHeader icon={Package} tone="violet" title="Products" subtitle="Catalog with price & discount - publish any product to Google as a post"
        actions={<>
          <a href="https://business.google.com/locations" target="_blank" rel="noreferrer"><Button variant="secondary"><ExternalLink className="h-4 w-4" /> Google Products tab</Button></a>
          <Link href={`/gmb/${clientId}/products/new`}><Button><Plus className="h-4 w-4" /> Add product</Button></Link>
        </>} />
      <div className="space-y-4 p-4 sm:p-5">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        {loading && !data ? <Skeleton className="h-48" /> : items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => (
              <div key={p.id} className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                <Link href={`/gmb/${clientId}/products/${p.id}`} className="relative block aspect-[4/3] bg-zinc-100 dark:bg-zinc-800">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : <Package className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-zinc-300" />}
                  {p.discounted_price != null && p.price ? (
                    <span className="absolute left-2 top-2 rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">{Math.round((1 - p.discounted_price / p.price) * 100)}% off</span>
                  ) : null}
                </Link>
                <div className="space-y-1 p-3">
                  <p className="truncate font-medium text-zinc-900 dark:text-white">{p.name}</p>
                  <p className="text-xs text-zinc-500">{p.category || "No category"}</p>
                  <p className="text-sm">
                    {p.discounted_price != null ? <><span className="font-semibold text-emerald-600">{money(p.discounted_price)}</span> <span className="text-xs text-zinc-400 line-through">{money(p.price)}</span></> : <span className="font-semibold">{money(p.price) || "No price"}</span>}
                  </p>
                  <p className="text-[11px] text-zinc-400">{p.last_posted_at ? `Last posted ${new Date(p.last_posted_at).toLocaleDateString("en-IN")}` : "Not posted yet"}</p>
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1 !py-1.5 text-xs" disabled={busy === p.id} onClick={() => act(p.id, () => apiFetch(`/api/gmb/${clientId}/products/${p.id}/publish`, { body: {} }), (r) => (r.mock ? "Posted (demo mode)." : "Posted to Google."))}>
                      {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Post to Google
                    </Button>
                    <Link href={`/gmb/${clientId}/products/${p.id}`}><Button variant="secondary" className="!py-1.5 text-xs" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                    <Button variant="dangerGhost" className="!py-1.5 text-xs" aria-label="Delete" onClick={() => window.confirm(`Delete "${p.name}"?`) && act(p.id, () => apiFetch(`/api/gmb/${clientId}/products/${p.id}`, { method: "DELETE" }), "Deleted.")}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={Package} title="No products yet" text="Add products with price, discount, image and a landing page." action={<Link href={`/gmb/${clientId}/products/new`}><Button>Add product</Button></Link>} />}
      </div>
    </Card>
  );
}
