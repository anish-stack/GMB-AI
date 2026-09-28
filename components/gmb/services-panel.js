"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Loader2, Plus, Save, Trash2, Wrench } from "lucide-react";
import { Card, Button, Field, Input, Select, Textarea, Alert, Skeleton, EmptyState, PanelHeader, Modal } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

const priceLabel = (p) => (p === null || p === undefined || p === "" ? "No price" : Number(p) === 0 ? "Free" : `₹${Number(p).toLocaleString("en-IN")}`);

function EditService({ item, onSave, onDelete, onClose }) {
  const [f, setF] = useState(() => ({ ...item, priceType: item.price === null || item.price === undefined || item.price === "" ? "none" : Number(item.price) === 0 ? "free" : "fixed" }));
  const save = () => onSave({ ...f, price: f.priceType === "none" ? null : f.priceType === "free" ? 0 : Number(f.price) || 0 });
  return (
    <Modal open onClose={onClose} title="Edit service details" footer={<>
      {onDelete ? <Button variant="dangerGhost" onClick={onDelete}><Trash2 className="h-4 w-4" /> Delete service</Button> : null}
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button onClick={save} disabled={!String(f.name || "").trim()}>Save</Button>
    </>}>
      <div className="space-y-4">
        {f.serviceTypeId ? (
          <div><p className="text-xs text-zinc-500">Service</p><p className="font-semibold">{f.name}</p></div>
        ) : (
          <Field label="Service name"><Input value={f.name} maxLength={140} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price">
            <Select value={f.priceType} onChange={(e) => setF({ ...f, priceType: e.target.value })}>
              <option value="none">No price</option><option value="free">Free</option><option value="fixed">Fixed</option>
            </Select>
          </Field>
          <Field label="Service price (INR)">
            <Input type="number" min={0} disabled={f.priceType !== "fixed"} value={f.priceType === "fixed" ? f.price ?? "" : ""} onChange={(e) => setF({ ...f, price: e.target.value })} />
          </Field>
        </div>
        <Field label="Service description" hint={`${String(f.description || "").length}/300`}>
          <Textarea rows={5} maxLength={300} value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function AddService({ category, onAdd, onClose, existing }) {
  const [custom, setCustom] = useState("");
  const [q, setQ] = useState("");
  const have = new Set(existing.map((i) => i.serviceTypeId).filter(Boolean));
  const types = (category.serviceTypes || []).filter((t) => !have.has(t.id) && (!q || t.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <Modal open onClose={onClose} title={`Add services - ${category.name}`} size="lg">
      <div className="space-y-4">
        {category.serviceTypes?.length ? (
          <>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Google's suggested services" />
            <div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto">
              {types.map((t) => (
                <button key={t.id} type="button" onClick={() => onAdd({ serviceTypeId: t.id, name: t.name, category: category.id, description: "", price: null })}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 dark:ring-zinc-700 dark:hover:bg-zinc-800">
                  <Plus className="h-3 w-3" /> {t.name}
                </button>
              ))}
              {!types.length ? <p className="text-xs text-zinc-400">No more suggestions.</p> : null}
            </div>
          </>
        ) : null}
        <div className="flex gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <Input value={custom} maxLength={140} onChange={(e) => setCustom(e.target.value)} placeholder="Add a custom service" />
          <Button disabled={!custom.trim()} onClick={() => { onAdd({ serviceTypeId: null, name: custom.trim(), category: category.id, description: "", price: null }); setCustom(""); }}>Add</Button>
        </div>
      </div>
    </Modal>
  );
}

export function ServicesPanel({ clientId }) {
  const { data, error, loading, reload } = useApi(`/api/gmb/${clientId}/services`);
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const [add, setAdd] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const list = items ?? (data?.items || []).map((i, n) => ({ ...i, _k: n }));
  const dirty = items !== null;
  const cats = useMemo(() => data?.categories || [], [data]);
  const change = (next) => setItems(next.map((i, n) => ({ ...i, _k: i._k ?? `n${n}${Date.now()}` })));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/api/gmb/${clientId}/services`, { method: "PUT", body: { items: list } });
      setItems(null);
      reload();
      setMsg({ tone: "green", text: data?.is_mock ? "Saved (demo data)." : "Services sent to Google. They can take a few minutes to appear." });
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <PanelHeader icon={Wrench} tone="blue" title="Services" subtitle="Grouped by business category - description and price show on Google"
        actions={<Button onClick={save} disabled={!dirty || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save to Google</Button>} />
      <div className="space-y-5 p-4 sm:p-5">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        {dirty ? <Alert tone="amber">Unsaved changes - click “Save to Google”.</Alert> : null}
        {loading && !data ? <Skeleton className="h-48" /> : !cats.length ? <EmptyState icon={Wrench} title="No categories" text="Connect and sync Google first." /> : cats.map((c) => {
          const inCat = list.filter((i) => i.category === c.id || (!i.category && c.primary));
          return (
            <section key={c.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <p className="font-semibold text-zinc-900 dark:text-white">{c.name}</p>
                <p className="text-xs text-zinc-500">{c.primary ? "Primary category" : "Additional category"}</p>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {inCat.map((i) => (
                  <li key={i._k}>
                    <button type="button" onClick={() => setEdit(i)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-800 dark:text-zinc-200">{i.name}</p>
                        <p className="truncate text-xs text-zinc-400">{priceLabel(i.price)}{i.description ? ` · ${i.description}` : " · no description"}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setAdd(c)} className="flex items-center gap-1.5 px-4 py-3 text-sm font-semibold text-sky-600 hover:underline">
                <Plus className="h-4 w-4" /> Add more services
              </button>
            </section>
          );
        })}
      </div>
      {edit ? (
        <EditService item={edit} onClose={() => setEdit(null)}
          onSave={(v) => { change(list.map((i) => (i._k === edit._k ? { ...i, ...v } : i))); setEdit(null); }}
          onDelete={() => { change(list.filter((i) => i._k !== edit._k)); setEdit(null); }} />
      ) : null}
      {add ? <AddService category={add} existing={list} onClose={() => setAdd(null)} onAdd={(v) => change([...list, v])} /> : null}
    </Card>
  );
}
