"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Package, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Card, Button, Field, Input, Select, Textarea, Alert, Skeleton, EmptyState, PanelHeader, Modal } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

const money = (v) => (v === null || v === undefined ? "" : `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
const empty = { name: "", category: "", price: "", discounted_price: "", description: "", landing_url: "", cta: "ORDER" };

function ProductForm({ clientId, product, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ ...empty, ...(product || {}), price: product?.price ?? "", discounted_price: product?.discounted_price ?? "" }));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const off = f.price && f.discounted_price ? Math.round((1 - Number(f.discounted_price) / Number(f.price)) * 100) : null;
  async function save() {
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      for (const k of ["name", "category", "price", "discounted_price", "description", "landing_url", "cta"]) fd.append(k, f[k] ?? "");
      if (file) fd.append("image", file);
      const res = await fetch(product ? `/api/gmb/${clientId}/products/${product.id}` : `/api/gmb/${clientId}/products`, { method: product ? "PATCH" : "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={product ? "Edit product" : "Add product"} size="lg" footer={<Button onClick={save} disabled={busy || !f.name.trim()}>{busy ? "Saving…" : "Save"}</Button>}>
      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <Field label="Product name *" hint={`${f.name.length}/58`}><Input maxLength={58} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Category"><Input value={f.category || ""} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Web Development Services" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Product price (INR)"><Input type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
            <Field label="Discounted price (INR)" hint={off > 0 ? `${off}% off` : "Optional"}><Input type="number" min={0} value={f.discounted_price} onChange={(e) => setF({ ...f, discounted_price: e.target.value })} /></Field>
          </div>
          <Field label="Product description" hint={`${String(f.description || "").length}/1,000`}><Textarea rows={4} maxLength={1000} value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Product landing page URL (optional)" hint={`${String(f.landing_url || "").length}/1,500`}><Input value={f.landing_url || ""} maxLength={1500} onChange={(e) => setF({ ...f, landing_url: e.target.value })} placeholder="https://" /></Field>
          <Field label="Button on the Google post">
            <Select value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })}>
              {[["ORDER", "Order online"], ["SHOP", "Buy / Shop"], ["BOOK", "Book"], ["LEARN_MORE", "Learn more"], ["CALL", "Call now"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          {err ? <Alert>{err}</Alert> : null}
        </div>
        <label className="flex h-fit cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500 dark:border-zinc-700">
          {file ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={URL.createObjectURL(file)} alt="" className="aspect-square w-full rounded-xl object-cover" />
          ) : f.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.image_url} alt="" className="aspect-square w-full rounded-xl object-cover" />
          ) : <Package className="h-10 w-10 text-zinc-300" />}
          {file || f.image_url ? "Change image" : "Add image (JPG/PNG)"}
          <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>
    </Modal>
  );
}

export function ProductsPanel({ clientId }) {
  const { data, error, loading, reload } = useApi(`/api/gmb/${clientId}/products`);
  const [edit, setEdit] = useState(undefined);
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
      <PanelHeader icon={Package} tone="violet" title="Products" subtitle="Your catalog - publish any product to Google as a post with price and button"
        actions={<>
          <a href="https://business.google.com/locations" target="_blank" rel="noreferrer"><Button variant="secondary"><ExternalLink className="h-4 w-4" /> Google Products tab</Button></a>
          <Button onClick={() => setEdit(null)}><Plus className="h-4 w-4" /> Add product</Button>
        </>} />
      <div className="space-y-4 p-4 sm:p-5">
        <Alert tone="blue">Google&apos;s Business Profile API doesn&apos;t expose the Products tab, so products are managed here and published as Google posts. To edit the Products tab itself use the button above.</Alert>
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        {loading && !data ? <Skeleton className="h-48" /> : items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : <Package className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-zinc-300" />}
                  {p.discounted_price != null ? <span className="absolute left-2 top-2 rounded-md bg-zinc-900/80 px-2 py-0.5 text-[11px] font-semibold text-white">Special</span> : null}
                </div>
                <div className="space-y-1 p-3">
                  <p className="font-medium text-zinc-900 dark:text-white">{p.name}</p>
                  <p className="text-sm">
                    {p.discounted_price != null ? <><span className="font-semibold text-emerald-600">{money(p.discounted_price)}</span> <span className="text-xs text-zinc-400 line-through">{money(p.price)}</span></> : <span className="font-semibold">{money(p.price) || "No price"}</span>}
                  </p>
                  <p className="text-[11px] text-zinc-400">{p.last_posted_at ? `Last posted ${new Date(p.last_posted_at).toLocaleDateString("en-IN")}` : "Not posted yet"}</p>
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1 !py-1.5 text-xs" disabled={busy === p.id} onClick={() => act(p.id, () => apiFetch(`/api/gmb/${clientId}/products/${p.id}/publish`, { body: {} }), (r) => (r.mock ? "Posted (demo mode)." : "Posted to Google."))}>
                      {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Post to Google
                    </Button>
                    <Button variant="secondary" className="!py-1.5 text-xs" onClick={() => setEdit(p)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="dangerGhost" className="!py-1.5 text-xs" aria-label="Delete" onClick={() => window.confirm(`Delete "${p.name}"?`) && act(p.id, () => apiFetch(`/api/gmb/${clientId}/products/${p.id}`, { method: "DELETE" }), "Deleted.")}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={Package} title="No products yet" text="Add products with price, discount, image and a landing page." action={<Button onClick={() => setEdit(null)}>Add product</Button>} />}
      </div>
      {edit !== undefined ? <ProductForm clientId={clientId} product={edit} onClose={() => setEdit(undefined)} onSaved={() => { setEdit(undefined); reload(); }} /> : null}
    </Card>
  );
}
