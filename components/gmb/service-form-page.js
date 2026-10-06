"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { Card, Button, Field, Input, Select, Textarea, Alert, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/hooks/use-api";

/**
 * Full page add / edit of ONE Google service.
 * index = position in Google's list ("new" for a new one). The whole list is
 * sent back to Google on save (Google's API replaces serviceItems as a set).
 */
export function ServiceFormPage({ clientId, index, presetCategory = null, business }) {
  const router = useRouter();
  const isNew = index === "new";
  const [data, setData] = useState(null);
  const [f, setF] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    apiFetch(`/api/gmb/${clientId}/services`).then((d) => {
      if (!alive) return;
      setData(d);
      if (isNew) {
        const cat = d.categories.find((c) => c.id === presetCategory) || d.categories.find((c) => c.primary) || d.categories[0];
        setF({ serviceTypeId: null, name: "", category: cat?.id || null, description: "", priceType: "none", price: "" });
      } else {
        const it = d.items[Number(index)];
        if (!it) return setErr("Service not found - it may have been changed on Google. Go back and refresh.");
        const priceType = it.price === null || it.price === undefined ? "none" : Number(it.price) === 0 ? "free" : "fixed";
        setF({ ...it, priceType, price: priceType === "fixed" ? it.price : "" });
      }
    }).catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [clientId, index, isNew, presetCategory]);

  const cat = useMemo(() => data?.categories.find((c) => c.id === f?.category), [data, f]);
  const taken = new Set((data?.items || []).map((i) => i.serviceTypeId).filter(Boolean));
  const suggestions = (cat?.serviceTypes || []).filter((t) => !taken.has(t.id) && (!q || t.name.toLowerCase().includes(q.toLowerCase())));

  const back = () => router.push(`/gmb/${clientId}?tab=services`);
  async function persist(items, key) {
    setBusy(key);
    setErr("");
    try {
      await apiFetch(`/api/gmb/${clientId}/services`, { method: "PUT", body: { items } });
      back();
      router.refresh();
    } catch (e) {
      setErr(e.message);
      setBusy("");
    }
  }
  function save() {
    if (!String(f.name || "").trim()) return setErr("Service name is required.");
    if (f.priceType === "fixed" && !(Number(f.price) > 0)) return setErr("Enter a price, or choose No price / Free.");
    const item = { serviceTypeId: f.serviceTypeId || null, name: f.name.trim(), category: f.category, description: f.description || "", price: f.priceType === "none" ? null : f.priceType === "free" ? 0 : Number(f.price) };
    const items = [...data.items];
    if (isNew) items.push(item);
    else items[Number(index)] = item;
    persist(items, "save");
  }
  function remove() {
    if (!window.confirm(`Delete "${f.name}" from Google?`)) return;
    persist(data.items.filter((_, i) => i !== Number(index)), "delete");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href={`/gmb/${clientId}?tab=services`} className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> {business} · Services</Link>
        <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{isNew ? "Add service" : "Edit service"}</h1>
        <p className="text-sm text-zinc-500">Shown on Google Search and Maps under Services.</p>
      </div>
      {err ? <Alert>{err}</Alert> : null}
      {!f ? (err ? null : <Skeleton className="h-96" />) : (
        <Card className="space-y-5 p-5">
          <Field label="Business category">
            <Select value={f.category || ""} disabled={!isNew} onChange={(e) => setF({ ...f, category: e.target.value, serviceTypeId: null })}>
              {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.primary ? " (primary)" : ""}</option>)}
            </Select>
          </Field>

          {isNew && cat?.serviceTypes?.length ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Google&apos;s suggested services (tap one) - or type your own below</p>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suggestions" className="mb-2" />
              <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                {suggestions.map((t) => (
                  <button key={t.id} type="button" onClick={() => setF({ ...f, serviceTypeId: t.id, name: t.name })}
                    className={`rounded-full px-3 py-1.5 text-xs ring-1 ring-inset ${f.serviceTypeId === t.id ? "bg-brand-500 text-white ring-brand-500" : "ring-zinc-200 hover:bg-zinc-50 dark:ring-zinc-700 dark:hover:bg-zinc-800"}`}>{t.name}</button>
                ))}
                {!suggestions.length ? <p className="text-xs text-zinc-400">No more suggestions.</p> : null}
              </div>
            </div>
          ) : null}

          <Field label="Service name" hint={f.serviceTypeId ? "Google's standard service - name can't be changed" : `${String(f.name || "").length}/140`}>
            <Input value={f.name} maxLength={140} disabled={Boolean(f.serviceTypeId)} onChange={(e) => setF({ ...f, name: e.target.value, serviceTypeId: null })} placeholder="e.g. Root canal treatment" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price">
              <Select value={f.priceType} onChange={(e) => setF({ ...f, priceType: e.target.value })}>
                <option value="none">No price</option><option value="free">Free</option><option value="fixed">Fixed price</option>
              </Select>
            </Field>
            <Field label="Service price (INR)">
              <Input type="number" min={1} disabled={f.priceType !== "fixed"} value={f.priceType === "fixed" ? f.price : ""} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="999" />
            </Field>
          </div>

          <Field label="Description" hint={`${String(f.description || "").length}/300`}>
            <Textarea rows={6} maxLength={300} value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What's included, who it's for, how long it takes…" />
          </Field>

          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            {!isNew ? <Button variant="dangerGhost" onClick={remove} disabled={Boolean(busy)}>{busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete</Button> : null}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={back} disabled={Boolean(busy)}>Cancel</Button>
              <Button onClick={save} disabled={Boolean(busy)}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {isNew ? "Add to Google" : "Save to Google"}</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
