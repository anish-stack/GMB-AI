"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { Card, Button, Field, Input, Select, Textarea, Alert, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/hooks/use-api";

const empty = { name: "", category: "", price: "", discounted_price: "", description: "", landing_url: "", cta: "ORDER", image_url: null };
const CTAS = [["ORDER", "Order online"], ["SHOP", "Buy"], ["BOOK", "Book"], ["LEARN_MORE", "Learn more"], ["SIGN_UP", "Sign up"], ["CALL", "Call now"]];

/** Full page add / edit product: /gmb/:id/products/new and /gmb/:id/products/:pid */
export function ProductFormPage({ clientId, productId = null, business }) {
  const router = useRouter();
  const isNew = !productId;
  const [f, setF] = useState(isNew ? empty : null);
  const [file, setFileState] = useState(null);
  const [preview, setPreview] = useState(null);
  const setFile = (fl) => {
    if (preview) URL.revokeObjectURL(preview);
    setFileState(fl);
    setPreview(fl ? URL.createObjectURL(fl) : null);
  };
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isNew) return undefined;
    let alive = true;
    apiFetch(`/api/gmb/${clientId}/products`).then((d) => {
      if (!alive) return;
      const p = (d.items || []).find((x) => String(x.id) === String(productId));
      if (!p) return setErr("Product not found.");
      setF({ ...empty, ...p, price: p.price ?? "", discounted_price: p.discounted_price ?? "" });
    }).catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [clientId, productId, isNew]);

  const back = () => router.push(`/gmb/${clientId}?tab=products`);
  const off = f?.price && f?.discounted_price ? Math.round((1 - Number(f.discounted_price) / Number(f.price)) * 100) : null;

  async function save() {
    setBusy("save");
    setErr("");
    try {
      const fd = new FormData();
      for (const k of ["name", "category", "price", "discounted_price", "description", "landing_url", "cta"]) fd.append(k, f[k] ?? "");
      if (file) fd.append("image", file);
      const res = await fetch(isNew ? `/api/gmb/${clientId}/products` : `/api/gmb/${clientId}/products/${productId}`, { method: isNew ? "POST" : "PATCH", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      back();
      router.refresh();
    } catch (e) {
      setErr(e.message);
      setBusy("");
    }
  }
  async function remove() {
    if (!window.confirm(`Delete "${f.name}"?`)) return;
    setBusy("delete");
    try {
      await apiFetch(`/api/gmb/${clientId}/products/${productId}`, { method: "DELETE" });
      back();
    } catch (e) {
      setErr(e.message);
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link href={`/gmb/${clientId}?tab=products`} className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> {business} · Products</Link>
        <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{isNew ? "Add product" : "Edit product"}</h1>
      </div>
      {err ? <Alert>{err}</Alert> : null}
      {!f ? (err ? null : <Skeleton className="h-96" />) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card className="space-y-4 p-5">
            <Field label="Product name *" hint={`${f.name.length}/58`}><Input maxLength={58} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Category"><Input value={f.category || ""} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="e.g. Web Development Services" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price (INR)"><Input type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
              <Field label="Discounted price (INR)" hint={off > 0 ? `${off}% off` : "Optional"}><Input type="number" min={0} value={f.discounted_price} onChange={(e) => setF({ ...f, discounted_price: e.target.value })} /></Field>
            </div>
            <Field label="Description" hint={`${String(f.description || "").length}/1,000`}><Textarea rows={6} maxLength={1000} value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <Field label="Landing page URL (optional)"><Input value={f.landing_url || ""} maxLength={1500} onChange={(e) => setF({ ...f, landing_url: e.target.value })} placeholder="https://" /></Field>
            <Field label="Button on the Google post"><Select value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })}>{CTAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          </Card>
          <div className="space-y-4">
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">Product image</p>
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 text-center text-xs text-zinc-500 hover:border-brand-400 dark:border-zinc-700">
                {preview || f.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview || f.image_url} alt="" className="h-full w-full object-cover" />
                ) : <><ImagePlus className="h-8 w-8 text-zinc-300" /> JPG or PNG, up to 5 MB</>}
                <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              {preview || f.image_url ? <p className="mt-2 text-center text-xs text-zinc-400">Click the image to replace it</p> : null}
            </Card>
            <Card className="space-y-2 p-4">
              <Button className="w-full justify-center" onClick={save} disabled={Boolean(busy) || !f.name.trim()}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {isNew ? "Add product" : "Save changes"}</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={back} disabled={Boolean(busy)}>Cancel</Button>
              {!isNew ? <Button variant="dangerGhost" className="w-full justify-center" onClick={remove} disabled={Boolean(busy)}><Trash2 className="h-4 w-4" /> Delete product</Button> : null}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
