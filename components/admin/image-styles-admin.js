"use client";

import { useState } from "react";
import { CheckCircle2, ImageIcon, Loader2, Plus, Save, Sparkles, Star, Trash2, Wand2 } from "lucide-react";
import { Card, Button, Input, Textarea, Select, Alert, Skeleton, Badge, Field } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

const MODE_LABEL = { BRANDED_PHOTO: "AI photo + our overlay (logo, headline, button)", AI_POSTER: "AI designs the whole poster (text, icons, button)", PHOTO_ONLY: "Plain AI photo" };
const OVERLAY_LABEL = { FULL: "Logo + headline + button (classic)", LOGO: "Only the client's logo", NONE: "Nothing - keep the AI image as is" };

function StyleEditor({ style, meta, clients, onSaved, onDeleted }) {
  const isNew = !style.id;
  const [f, setF] = useState({ name: style.name || "", description: style.description || "", mode: style.mode || "AI_POSTER", overlay: style.overlay || "LOGO", aspect: style.aspect || "4:3", prompt: style.prompt || "", active: style.active !== 0, is_default: Boolean(style.is_default) });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [client, setClient] = useState(clients[0]?.id || "");
  const [test, setTest] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e });

  async function save() {
    setBusy("save");
    setErr("");
    try {
      const r = isNew ? await apiFetch("/api/admin/image-styles", { body: f }) : await apiFetch(`/api/admin/image-styles/${style.id}`, { method: "PATCH", body: f });
      onSaved(r.style);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  async function runTest(savePreview = false) {
    setBusy(savePreview ? "preview" : "test");
    setErr("");
    try {
      const r = await apiFetch(`/api/admin/image-styles/${style.id || 0}/test`, { body: { client_id: client, draft: f, save_preview: savePreview } });
      setTest(r);
      if (savePreview) onSaved({ ...style, preview_url: r.preview_url });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  async function remove() {
    if (!window.confirm(`Delete "${style.name}"? Clients using it go back to the default style.`)) return;
    setBusy("del");
    try {
      await apiFetch(`/api/admin/image-styles/${style.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setErr(e.message);
      setBusy("");
    }
  }
  const insert = (k) => setF((x) => ({ ...x, prompt: `${x.prompt}{{${k}}}` }));

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Style name"><Input value={f.name} onChange={set("name")} maxLength={80} placeholder="e.g. Clinic poster - blue" /></Field>
          <Field label="Image size"><Select value={f.aspect} onChange={set("aspect")}>{meta.aspects.map((a) => <option key={a} value={a}>{a}{a === "4:3" ? " (Google recommended)" : ""}</option>)}</Select></Field>
          <Field label="How the image is made" className="sm:col-span-2"><Select value={f.mode} onChange={set("mode")}>{meta.modes.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}</Select></Field>
          {f.mode !== "BRANDED_PHOTO" ? (
            <Field label="Added on top" className="sm:col-span-2"><Select value={f.overlay} onChange={set("overlay")}>{meta.overlays.filter((o) => o !== "FULL").map((o) => <option key={o} value={o}>{OVERLAY_LABEL[o]}</option>)}</Select></Field>
          ) : null}
          <Field label="Short description (workspaces see this)" className="sm:col-span-2"><Input value={f.description} onChange={set("description")} maxLength={300} /></Field>
        </div>
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Image prompt</p>
            <span className="text-[11px] text-zinc-400">{f.prompt.length}/8000</span>
          </div>
          <Textarea rows={16} value={f.prompt} onChange={set("prompt")} className="font-mono text-xs leading-5" maxLength={8000} />
          <div className="mt-2 flex flex-wrap gap-1">
            {meta.placeholders.map(([k, label]) => (
              <button key={k} type="button" title={label} onClick={() => insert(k)} className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 hover:bg-brand-50 hover:text-brand-700 dark:bg-zinc-800 dark:text-zinc-300">{`{{${k}}}`}</button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">Placeholders are filled per post (business, city, headline, 4 points from the services, button text, brand colour…). For posters, write the exact text in quotes so the AI spells it right.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-500" checked={f.active} onChange={set("active")} /> Available to workspaces</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-500" checked={f.is_default} onChange={set("is_default")} /> Default style for everyone</label>
        </div>
        {err ? <Alert>{err}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={Boolean(busy) || !f.name.trim() || !f.prompt.trim()}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {isNew ? "Create style" : "Save style"}</Button>
          {!isNew && !style.is_default ? <Button variant="dangerGhost" onClick={remove} disabled={Boolean(busy)}><Trash2 className="h-4 w-4" /> Delete</Button> : null}
        </div>
      </div>

      <Card className="space-y-3 p-4 xl:sticky xl:top-4 xl:self-start">
        <p className="flex items-center gap-2 text-sm font-semibold"><Wand2 className="h-4 w-4 text-violet-500" /> Test on a real client</p>
        <Select value={client} onChange={(e) => setClient(e.target.value)}>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name} · {c.tenant}</option>)}
        </Select>
        <Button className="w-full justify-center" onClick={() => runTest(false)} disabled={Boolean(busy) || !client}>{busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate test image</Button>
        <p className="text-[11px] text-zinc-400">Uses the unsaved prompt above. No credits are charged. Takes 10-40 seconds.</p>
        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
          {test?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={test.image} alt="Test" className="h-full w-full object-cover" />
          ) : style.preview_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={style.preview_url} alt="Preview" className="h-full w-full object-cover" />
          ) : <div className="flex h-full items-center justify-center text-zinc-300"><ImageIcon className="h-10 w-10" /></div>}
        </div>
        {test?.provider ? <p className="text-[11px] text-zinc-400">via {test.provider}</p> : null}
        {!isNew ? <Button variant="secondary" className="w-full justify-center" onClick={() => runTest(true)} disabled={Boolean(busy) || !client}>{busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} Generate & save as style thumbnail</Button> : null}
        {test?.prompt ? (
          <details className="text-[11px] text-zinc-500"><summary className="cursor-pointer">Final prompt sent</summary><pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900">{test.prompt}</pre></details>
        ) : null}
      </Card>
    </div>
  );
}

/** Admin -> Image styles: presets that decide how post images are generated. */
export function ImageStylesAdmin({ clients }) {
  const { data, error, loading, reload } = useApi("/api/admin/image-styles");
  const [sel, setSel] = useState(null);
  const items = data?.items || [];
  const current = sel === "new" ? { prompt: data?.seeds?.[1]?.prompt || "" } : items.find((s) => s.id === sel) || items[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"><ImageIcon className="h-5 w-5 text-brand-500" /> Image styles</h1>
          <p className="text-sm text-zinc-500">Control how AI post images look. Workspaces pick a style per GMB profile (or per post); the default is used otherwise.</p>
        </div>
        <Button onClick={() => setSel("new")}><Plus className="h-4 w-4" /> New style</Button>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {loading && !data ? <Skeleton className="h-96" /> : (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {items.map((s) => (
              <button key={s.id} type="button" onClick={() => setSel(s.id)}
                className={`w-full overflow-hidden rounded-xl border-2 text-left ${current?.id === s.id && sel !== "new" ? "border-brand-500" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800"}`}>
                {s.preview_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.preview_url} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : null}
                <div className="p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">{s.is_default ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}{s.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={s.mode === "AI_POSTER" ? "violet" : "blue"}>{s.mode === "AI_POSTER" ? "Poster" : s.mode === "PHOTO_ONLY" ? "Photo" : "Branded"}</Badge>
                    {!s.active ? <Badge tone="red">Hidden</Badge> : <Badge tone="emerald"><CheckCircle2 className="mr-0.5 inline h-3 w-3" />Live</Badge>}
                    {s.clients ? <Badge>{s.clients} client(s)</Badge> : null}
                  </div>
                </div>
              </button>
            ))}
            {!items.length ? <p className="text-sm text-zinc-500">No styles yet - run the v11 migration.</p> : null}
          </div>
          <Card className="p-4 sm:p-5">
            {current ? (
              <StyleEditor key={sel === "new" ? "new" : `${current.id}:${current.updated_at || ""}`} style={sel === "new" ? { prompt: current.prompt } : current} meta={data} clients={clients}
                onSaved={(s) => { setSel(s?.id ?? sel); reload(); }} onDeleted={() => { setSel(null); reload(); }} />
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}
