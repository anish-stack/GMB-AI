"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Input, Textarea } from "@/components/ui";

export function Label({ children, hint }) {
  return (
    <span className="mb-1 flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{children}</span>
      {hint ? <span className="text-[11px] text-zinc-400">{hint}</span> : null}
    </span>
  );
}

export const prettyKey = (k) => String(k).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase());

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
      <span className="text-sm text-zinc-700 dark:text-zinc-200">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

/**
 * Image picker. Value is { url } (or null). `upload(file)` must return { url }.
 * Used both for website fields (logo, favicon...) and page sections.
 */
export function ImageField({ label, value, onChange, upload, aspect = "aspect-video" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const url = value?.url || (typeof value === "string" ? value : "");
  async function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) return setErr("Choose an image file");
    if (f.size > 8 * 1024 * 1024) return setErr("Max 8 MB");
    setBusy(true);
    setErr("");
    try {
      const r = await upload(f);
      onChange({ url: r.url, publicId: r.publicId || null });
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {label ? <Label>{label}</Label> : null}
      <div className={`group relative ${aspect} w-full overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <button type="button" onClick={() => ref.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-zinc-400 hover:text-zinc-600">
            <ImagePlus className="h-6 w-6" /> Upload image
          </button>
        )}
        {busy ? <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-zinc-950/70"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div> : null}
        {url && !busy ? (
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
            <button type="button" onClick={() => ref.current?.click()} className="rounded-lg bg-white/90 px-2 py-1 text-[11px] font-semibold text-zinc-800">Replace</button>
            <button type="button" onClick={() => onChange(null)} className="rounded-lg bg-white/90 p-1 text-rose-600" aria-label="Remove"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : null}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
      {err ? <p className="mt-1 text-xs text-rose-600">{err}</p> : null}
    </div>
  );
}

const LONG = /(text|body|description|subtitle|content|answer|quote|message|bio|note|intro|paragraph)/i;
const isImage = (k, v) => (v && typeof v === "object" && !Array.isArray(v) && "url" in v) || (/(image|photo|logo|avatar|icon_?img|background|bg)$/i.test(k) && (v == null || typeof v === "object"));

/**
 * Generic editor for any JSON-like section data (multi-page sections have many
 * shapes). Strings, numbers, booleans, images, string lists and item lists.
 */
export function DataForm({ value, onChange, upload, depth = 0 }) {
  const data = value && typeof value === "object" ? value : {};
  const set = (k, v) => onChange({ ...data, [k]: v });
  const keys = Object.keys(data).filter((k) => !["_id", "id", "__v"].includes(k));
  if (!keys.length) return <p className="text-xs text-zinc-400">No fields in this block.</p>;
  return (
    <div className={`grid gap-3 ${depth === 0 ? "sm:grid-cols-2" : ""}`}>
      {keys.map((k) => {
        const v = data[k];
        const wide = depth > 0 || Array.isArray(v) || (typeof v === "string" && (LONG.test(k) || v.length > 70)) || isImage(k, v) || (v && typeof v === "object");
        return (
          <div key={k} className={wide ? "sm:col-span-2" : ""}>
            <Field k={k} v={v} onChange={(x) => set(k, x)} upload={upload} depth={depth} />
          </div>
        );
      })}
    </div>
  );
}

function Field({ k, v, onChange, upload, depth }) {
  if (isImage(k, v)) return <ImageField label={prettyKey(k)} value={v} onChange={onChange} upload={upload} />;
  if (typeof v === "boolean") return <Toggle label={prettyKey(k)} checked={v} onChange={onChange} />;
  if (typeof v === "number") return (<label className="block"><Label>{prettyKey(k)}</Label><Input type="number" value={v} onChange={(e) => onChange(Number(e.target.value))} /></label>);
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === "string")) {
      return (
        <label className="block">
          <Label hint="one per line">{prettyKey(k)}</Label>
          <Textarea rows={Math.min(8, Math.max(3, v.length + 1))} value={v.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} />
        </label>
      );
    }
    return <ItemList label={prettyKey(k)} items={v} onChange={onChange} upload={upload} depth={depth} />;
  }
  if (v && typeof v === "object") {
    return (
      <fieldset className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1 text-xs font-semibold text-zinc-500">{prettyKey(k)}</legend>
        <DataForm value={v} onChange={onChange} upload={upload} depth={depth + 1} />
      </fieldset>
    );
  }
  const s = v == null ? "" : String(v);
  if (/color|colour/i.test(k) && /^#?[0-9a-f]{3,8}$/i.test(s || "#000")) {
    return (
      <label className="block">
        <Label>{prettyKey(k)}</Label>
        <div className="flex gap-2"><input type="color" value={s.startsWith("#") && s.length === 7 ? s : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-200" /><Input value={s} onChange={(e) => onChange(e.target.value)} /></div>
      </label>
    );
  }
  return (
    <label className="block">
      <Label hint={s.length > 60 ? `${s.length} chars` : null}>{prettyKey(k)}</Label>
      {LONG.test(k) || s.length > 70 ? <Textarea rows={Math.min(8, Math.max(3, Math.ceil(s.length / 70)))} value={s} onChange={(e) => onChange(e.target.value)} /> : <Input value={s} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

function blankLike(sample) {
  if (!sample || typeof sample !== "object") return "";
  return Object.fromEntries(Object.entries(sample).filter(([k]) => !["_id", "id"].includes(k)).map(([k, v]) => [k, typeof v === "number" ? 0 : typeof v === "boolean" ? v : Array.isArray(v) ? [] : v && typeof v === "object" ? ("url" in v ? null : blankLike(v)) : ""]));
}

function ItemList({ label, items, onChange, upload, depth }) {
  const [open, setOpen] = useState(0);
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const x = [...items];
    [x[i], x[j]] = [x[j], x[i]];
    onChange(x);
    setOpen(j);
  };
  return (
    <div>
      <Label hint={`${items.length} item(s)`}>{label}</Label>
      <div className="space-y-2">
        {items.map((it, i) => {
          const title = typeof it === "object" && it ? it.title || it.name || it.label || it.question || it.heading || it.number || `Item ${i + 1}` : String(it);
          return (
            <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium" onClick={() => setOpen(open === i ? -1 : i)}>{title}</button>
                <button type="button" onClick={() => move(i, -1)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Move up"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Move down"><ChevronDown className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => onChange(items.filter((_, x) => x !== i))} className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {open === i && typeof it === "object" && it ? (
                <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
                  <DataForm value={it} onChange={(x) => onChange(items.map((y, z) => (z === i ? x : y)))} upload={upload} depth={depth + 1} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => { onChange([...items, blankLike(items[0]) || { title: "", description: "" }]); setOpen(items.length); }}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:underline"><Plus className="h-3.5 w-3.5" /> Add item</button>
    </div>
  );
}
