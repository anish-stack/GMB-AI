"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, Eye, EyeOff, Globe, Image as ImageIcon, ImagePlus, Info, LayoutTemplate, Loader2, Mail, MapPin,
  MessageSquareQuote, Palette, Pencil, Plus, RefreshCw, Save, Search, Share2, Sparkles, Trash2, Wrench, Files, ToggleLeft, Inbox, X,
} from "lucide-react";
import { Card, Button, Input, Textarea, Select, Alert, Skeleton, Badge } from "@/components/ui";
import { wbApi, siteAction } from "./api";
import { DataForm, ImageField, Label, prettyKey } from "./fields";

const SINGLE_NAV = [
  ["overview", "Overview", Globe], ["brand", "Brand & logo", Palette], ["hero", "Hero slides", ImageIcon], ["about", "About", Info],
  ["services", "Services", Wrench], ["reviews", "Reviews", MessageSquareQuote], ["contact", "Contact", MapPin], ["footer", "Footer & social", Share2],
  ["seo", "SEO", Search], ["visibility", "Show / hide sections", ToggleLeft], ["leads", "Form leads", Inbox],
];
const MULTI_NAV = [
  ["overview", "Overview", Globe], ["brand", "Brand & logo", Palette], ["pages", "Pages & sections", Files], ["services", "Services", Wrench],
  ["reviews", "Reviews", MessageSquareQuote], ["contact", "Contact", MapPin], ["footer", "Footer & social", Share2], ["seo", "SEO", Search], ["leads", "Form leads", Inbox],
];
const SECTION_TYPES = ["hero", "about", "features", "services", "cta", "testimonials", "faq", "gallery", "team", "pricing", "stats", "text", "banner", "contact", "steps", "marquee", "areas", "callback"];
const STARTER = {
  hero: { title: "", subtitle: "", ctaText: "Contact us", ctaLink: "/contact", image: null },
  about: { heading: "About us", body: "", highlights: [], image: null },
  features: { heading: "", items: [{ icon: "check", title: "", description: "" }] },
  services: { heading: "Our services", items: [{ icon: "check", title: "", description: "", price: "" }] },
  cta: { heading: "", text: "", ctaText: "Call now", ctaLink: "/contact" },
  testimonials: { heading: "What customers say", items: [{ name: "", rating: 5, text: "", designation: "" }] },
  faq: { heading: "FAQs", items: [{ question: "", answer: "" }] },
  gallery: { heading: "Gallery", items: [{ image: null, caption: "" }] },
  team: { heading: "Our team", items: [{ name: "", role: "", image: null }] },
  pricing: { heading: "Pricing", items: [{ title: "", price: "", features: [] }] },
  stats: { items: [{ number: "", label: "" }] },
  text: { heading: "", body: "" },
  banner: { title: "", subtitle: "", image: null, ctaText: "", ctaLink: "" },
  contact: { heading: "Get in touch", showForm: true },
  steps: { heading: "How it works", items: [{ title: "", description: "" }] },
  marquee: { items: [] },
  areas: { heading: "Areas we serve", items: [] },
  callback: { heading: "Request a callback", text: "" },
};
const KIND_LABEL = { services: "service", reviews: "review", hero: "slide" };

/* ------------------------------ small building blocks ------------------------------ */
function Panel({ title, subtitle, children, actions }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-4 sm:px-6 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="text-base font-semibold text-zinc-900 dark:text-white">{title}</p>
          {subtitle ? <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="space-y-5 p-4 sm:p-6">{children}</div>
    </Card>
  );
}

/** Self-contained switch row (does not depend on the shared Toggle). */
function Switch({ label, hint, checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={Boolean(checked)} onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-left transition hover:border-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-zinc-800 dark:hover:border-zinc-700">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</span>
        {hint ? <span className="block text-xs text-zinc-500">{hint}</span> : null}
      </span>
      <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-brand-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

function SaveBar({ dirty, busy, onSave, onReset }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      {dirty ? <span className="mr-auto inline-flex items-center gap-1.5 text-xs font-medium text-amber-600"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes</span> : null}
      {dirty ? <Button variant="ghost" onClick={onReset} disabled={busy}>Discard</Button> : null}
      <Button onClick={onSave} disabled={!dirty || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes</Button>
    </div>
  );
}

/** Edit one website object section (basicInfo / about / contact / footer / seo / sections). */
function ObjectSection({ site, section, call, wid, onSaved, render }) {
  const initial = useMemo(() => JSON.parse(JSON.stringify(site?.[section] || {})), [site, section]);
  const [val, setVal] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dirty = JSON.stringify(val) !== JSON.stringify(initial);
  async function save() {
    setBusy(true);
    setErr("");
    try {
      const r = await call(`websites/${wid}/section/${section}`, { method: "PATCH", body: val });
      onSaved(r.site);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {render(val, (patch) => setVal((v) => ({ ...v, ...patch })))}
      {err ? <Alert>{err}</Alert> : null}
      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={() => setVal(initial)} />
    </>
  );
}

function ItemFields({ fields, draft, setDraft }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(([k, label, type]) => {
        if (type === "bool") {
          return <div key={k} className="sm:col-span-2"><Switch label={label} checked={draft[k] !== false} onChange={(v) => setDraft({ ...draft, [k]: v })} /></div>;
        }
        return (
          <label key={k} className={type === "textarea" ? "block sm:col-span-2" : "block"}>
            <Label>{label}</Label>
            {type === "textarea" ? <Textarea rows={5} value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              : type === "rating" ? <Select value={draft[k] ?? 5} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</Select>
                : <Input value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />}
          </label>
        );
      })}
    </div>
  );
}

/** Local file picker used while an item does not exist yet (uploaded right after it is created). */
function PendingImage({ file, onPick, square }) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return (
    <div>
      <Label>Image</Label>
      <label className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 transition hover:border-brand-500 hover:text-brand-500 dark:border-zinc-700 dark:bg-zinc-900 ${square ? "aspect-square max-w-[160px]" : "aspect-video"}`}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <><ImagePlus className="h-6 w-6" /><span className="text-xs font-medium">Choose image</span></>
        )}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPick(e.target.files?.[0] || null)} />
      </label>
      {file ? <button type="button" onClick={() => onPick(null)} className="mt-1.5 text-xs font-medium text-zinc-500 hover:text-rose-600">Remove image</button> : null}
    </div>
  );
}

/* ------------------------------ services / reviews / hero slides ------------------------------ */
function ArrayEditor({ items, kind, call, wid, onSaved, fields, imageField = "image", newItem }) {
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const base = kind === "hero" ? `websites/${wid}/hero` : `websites/${wid}/${kind}`;
  const noun = KIND_LABEL[kind] || "item";
  const square = kind === "reviews";
  const listOf = (site) => (kind === "hero" ? site.heroSlides : site[kind]) || [];
  const sorted = [...(items || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const isHidden = (it) => (kind === "reviews" ? it.isApproved === false : it.isActive === false);

  const close = () => { setOpen(null); setDraft(null); setPending(null); setErr(""); };
  const edit = (it) => { setOpen(it._id); setDraft({ ...it }); setPending(null); setErr(""); };
  const startNew = () => { setOpen("new"); setDraft({ ...newItem, displayOrder: sorted.length }); setPending(null); setErr(""); };

  async function save() {
    setBusy("save");
    setErr("");
    try {
      const body = Object.fromEntries(fields.map(([k]) => [k, draft[k] ?? ""]));
      let r;
      if (draft._id) {
        r = await call(`${base}/${draft._id}`, { method: "PATCH", body });
      } else {
        const before = new Set(sorted.map((x) => x._id));
        r = await call(base, { method: "POST", body });
        const created = listOf(r.site).find((x) => !before.has(x._id));
        if (created && pending) {
          const fd = new FormData();
          fd.append(imageField, pending);
          r = await call(`${base}/${created._id}`, { method: "PATCH", form: fd });
        }
      }
      onSaved(r.site);
      close();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  async function remove(it) {
    if (!window.confirm(`Delete "${it.title || it.name || `this ${noun}`}"?`)) return;
    setBusy(`del:${it._id}`);
    setErr("");
    try {
      const r = await call(`${base}/${it._id}`, { method: "DELETE" });
      onSaved(r.site);
      if (open === it._id) close();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  /** images go up as multipart on the item itself */
  const uploadFor = (id) => async (file) => {
    const fd = new FormData();
    fd.append(imageField, file);
    const r = await call(`${base}/${id}`, { method: "PATCH", form: fd });
    onSaved(r.site);
    return listOf(r.site).find((x) => x._id === id)?.[imageField] || {};
  };

  const formActions = (isNew) => (
    <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end dark:border-zinc-800">
      <Button variant="ghost" onClick={close} disabled={busy === "save"}>Cancel</Button>
      <Button onClick={save} disabled={busy === "save"}>
        {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : isNew ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />} {isNew ? `Add ${noun}` : "Save changes"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">{sorted.length} {noun}{sorted.length === 1 ? "" : "s"}</p>
        <Button onClick={startNew} disabled={open === "new"}><Plus className="h-4 w-4" /> Add {noun}</Button>
      </div>
      {err && open === null ? <Alert>{err}</Alert> : null}

      {open === "new" && draft ? (
        <div className="space-y-4 rounded-2xl border-2 border-brand-500 bg-white p-4 sm:p-5 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">New {noun}</p>
            <button type="button" onClick={close} aria-label="Close" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
            <PendingImage file={pending} onPick={setPending} square={square} />
            <ItemFields fields={fields} draft={draft} setDraft={setDraft} />
          </div>
          {err ? <Alert>{err}</Alert> : null}
          {formActions(true)}
        </div>
      ) : null}

      {!sorted.length && open !== "new" ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-center dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">No {noun}s yet</p>
          <p className="mt-1 text-sm text-zinc-500">Add the first one - it shows on the website as soon as you save.</p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {sorted.map((it) => {
          const active = open === it._id;
          return (
            <li key={it._id} className={`overflow-hidden rounded-2xl border bg-white transition dark:bg-zinc-950 ${active ? "border-2 border-brand-500" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"}`}>
              <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                <div className={`h-14 shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800 ${square ? "w-14 rounded-full" : "w-14 rounded-xl sm:w-20"}`}>
                  {it[imageField]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it[imageField].url} alt="" className="h-full w-full object-cover" />
                  ) : <div className="flex h-full items-center justify-center text-zinc-300 dark:text-zinc-600"><ImageIcon className="h-5 w-5" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{it.title || it.name || "Untitled"}</p>
                    {it.price ? <Badge>{it.price}</Badge> : null}
                    {isHidden(it) ? <Badge tone="slate">Hidden</Badge> : null}
                  </div>
                  {kind === "reviews" ? <p className="text-xs text-amber-500">{"★".repeat(it.rating || 5)}</p> : null}
                  <p className="mt-0.5 line-clamp-1 text-sm text-zinc-500">{it.description || it.text || it.subtitle || <span className="text-zinc-400">No description yet</span>}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => (active ? close() : edit(it))} aria-label={active ? "Close" : "Edit"}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                    {active ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}<span className="hidden sm:inline">{active ? "Close" : "Edit"}</span>
                  </button>
                  <button type="button" onClick={() => remove(it)} disabled={busy === `del:${it._id}`} aria-label="Delete"
                    className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/30">
                    {busy === `del:${it._id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {active && draft ? (
                <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/60 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <ImageField label="Image" value={draft[imageField]} onChange={(v) => setDraft({ ...draft, [imageField]: v })} upload={uploadFor(it._id)} aspect={square ? "aspect-square max-w-[160px]" : "aspect-video"} />
                    </div>
                    <ItemFields fields={fields} draft={draft} setDraft={setDraft} />
                  </div>
                  {err ? <Alert>{err}</Alert> : null}
                  {formActions(false)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------ pages (multi-page themes) ------------------------------ */
function PagesEditor({ pages, call, upload, reload }) {
  const [pid, setPid] = useState(pages[0]?._id || null);
  const page = pages.find((p) => p._id === pid) || pages[0];
  const [sid, setSid] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [addType, setAddType] = useState("text");
  const sections = [...(page?.sections || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const run = async (key, fn) => {
    setBusy(key);
    setErr("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };
  const move = (i, d) => run(`mv${i}`, async () => {
    const list = sections.map((s) => ({ ...s }));
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await call(`pages/${page._id}/sections`, { method: "PUT", body: { sections: list.map((s, k) => ({ ...s, displayOrder: k })) } });
  });

  if (!pages.length) return <p className="text-sm text-zinc-500">This website has no pages yet.</p>;
  const iconBtn = "rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800";
  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {pages.map((p) => (
          <button key={p._id} type="button" onClick={() => { setPid(p._id); setSid(null); }}
            className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${p._id === page?._id ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"}`}>
            {p.navLabel || p.title}
          </button>
        ))}
      </div>
      {err ? <Alert>{err}</Alert> : null}
      <ul className="space-y-3">
        {sections.map((s, i) => {
          const active = sid === s._id;
          return (
            <li key={s._id} className={`overflow-hidden rounded-2xl border bg-white dark:bg-zinc-950 ${active ? "border-2 border-brand-500" : "border-zinc-200 dark:border-zinc-800"} ${s.isActive === false ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 sm:px-4">
                <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                  <Badge>{prettyKey(s.type)}</Badge>
                  <p className="min-w-0 truncate text-sm font-medium text-zinc-900 dark:text-white">{s.data?.heading || s.data?.title?.replace(/\*/g, "") || prettyKey(s.type)}</p>
                  {s.isActive === false ? <Badge tone="slate">Hidden</Badge> : null}
                </div>
                <div className="ml-auto flex items-center gap-0.5">
                  <button type="button" className={iconBtn} disabled={i === 0 || Boolean(busy)} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                  <button type="button" className={iconBtn} disabled={i === sections.length - 1 || Boolean(busy)} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                  <button type="button" className={iconBtn} aria-label={s.isActive === false ? "Show section" : "Hide section"} title={s.isActive === false ? "Show on website" : "Hide from website"}
                    onClick={() => run(`vis${s._id}`, () => call(`pages/${page._id}/sections/${s._id}`, { method: "PATCH", body: { isActive: s.isActive === false } }))}>
                    {busy === `vis${s._id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : s.isActive === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    onClick={() => { setSid(active ? null : s._id); setDraft(JSON.parse(JSON.stringify(s.data || {}))); }}>
                    {active ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}<span className="hidden sm:inline">{active ? "Close" : "Edit"}</span>
                  </button>
                  <button type="button" className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30" aria-label="Delete section"
                    onClick={() => window.confirm("Delete this section?") && run(`del${s._id}`, () => call(`pages/${page._id}/sections/${s._id}`, { method: "DELETE" }))}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {active && draft ? (
                <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/60 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <DataForm value={draft} onChange={setDraft} upload={upload} />
                  <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end dark:border-zinc-800">
                    <Button variant="ghost" onClick={() => setDraft(JSON.parse(JSON.stringify(s.data || {})))}>Discard</Button>
                    <Button disabled={busy === `save${s._id}`} onClick={() => run(`save${s._id}`, () => call(`pages/${page._id}/sections/${s._id}`, { method: "PATCH", body: { data: draft } }))}>
                      {busy === `save${s._id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save section
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-zinc-300 p-4 sm:flex-row sm:items-center dark:border-zinc-700">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Add a section</span>
        <Select value={addType} onChange={(e) => setAddType(e.target.value)} className="sm:!w-auto">{SECTION_TYPES.map((t) => <option key={t} value={t}>{prettyKey(t)}</option>)}</Select>
        <Button variant="secondary" disabled={busy === "add"} onClick={() => run("add", () => call(`pages/${page._id}/sections`, { method: "POST", body: { type: addType, displayOrder: sections.length, data: STARTER[addType] || {} } }))}>
          {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add to {page?.navLabel || page?.title}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ main editor ------------------------------ */
export function WebsiteEditor({ clientId, wid, business }) {
  const router = useRouter();
  const call = useMemo(() => wbApi(clientId), [clientId]);
  const [site, setSite] = useState(null);
  const [pages, setPages] = useState([]);
  const [leads, setLeads] = useState(null);
  const [themes, setThemes] = useState(null);
  const [tab, setTab] = useState("overview");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [liveUrl, setLiveUrl] = useState("");

  const upload = useCallback(async (file) => {
    const fd = new FormData();
    fd.append("image", file);
    const r = await call("uploads/image", { method: "POST", form: fd });
    return r.image || r;
  }, [call]);

  const load = useCallback(async () => {
    try {
      const r = await call(`websites/${wid}`);
      setSite(r.site);
      if (r.site.pageType === "multi") setPages((await call(`websites/${wid}/pages`)).pages || []);
    } catch (e) {
      setErr(e.message);
    }
  }, [call, wid]);
  useEffect(() => {
    let alive = true;
    call(`websites/${wid}`)
      .then(async (r) => {
        if (!alive) return;
        setSite(r.site);
        if (r.site.pageType === "multi") {
          const p = await call(`websites/${wid}/pages`);
          if (alive) setPages(p.pages || []);
        }
      })
      .catch((e) => alive && setErr(e.message));
    // public URL of this site (builder root domain)
    fetch(`/api/gmb/${clientId}/website`)
      .then((r) => r.json())
      .then((j) => alive && setLiveUrl((j.websites || []).find((w) => String(w.id) === String(wid))?.url || ""))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [call, wid, clientId]);
  useEffect(() => {
    if (tab === "leads" && !leads) call(`websites/${wid}/submissions`).then((r) => setLeads(r.submissions || r.items || [])).catch((e) => setErr(e.message));
    if (tab === "overview" && !themes) siteAction(clientId, "themes").then((r) => setThemes(r.themes)).catch(() => setThemes([]));
  }, [tab, leads, themes, call, wid, clientId]);
  // success messages clear themselves; errors stay until the next action
  useEffect(() => {
    if (!msg || msg.tone !== "green") return undefined;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  async function act(action, extra = {}, confirmText = null, okText = null) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    setMsg(null);
    try {
      const r = await siteAction(clientId, action, { website_id: wid, ...extra });
      if (action === "delete") return router.push(`/gmb/${clientId}?tab=website`);
      setMsg({ tone: "green", text: okText || "Done." });
      if (r?.isLive !== undefined) setSite((s) => ({ ...s, isLive: r.isLive }));
      await load();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }
  async function changeTheme(themeId) {
    if (!themeId || themeId === (site.theme?._id || site.theme)) return;
    if (!window.confirm("Switch theme? Your content stays; only the design changes.")) return;
    setBusy("theme");
    try {
      const r = await call(`websites/${wid}/theme`, { method: "PATCH", body: { themeId } });
      setSite(r.site || site);
      await load();
      setMsg({ tone: "green", text: "Theme changed." });
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }

  if (err && !site) return <Alert>{err}</Alert>;
  if (!site) return <Skeleton className="h-[70vh]" />;
  const nav = site.pageType === "multi" ? MULTI_NAV : SINGLE_NAV;
  const saved = (s) => { setSite(s); setMsg({ tone: "green", text: "Saved." }); };
  const obj = (section, render) => <ObjectSection key={`${section}-${site.updatedAt || ""}`} site={site} section={section} call={call} wid={wid} onSaved={saved} render={render} />;
  const f = (val, set, k, label, type = "text", hint = null) => (
    <label className="block">
      <Label hint={hint}>{label}</Label>
      {type === "textarea" ? <Textarea rows={5} value={val[k] ?? ""} onChange={(e) => set({ [k]: e.target.value })} /> : <Input value={val[k] ?? ""} onChange={(e) => set({ [k]: e.target.value })} />}
    </label>
  );
  const actionCard = "flex items-start gap-3 rounded-2xl border border-zinc-200 p-4 text-left transition hover:border-brand-500 disabled:opacity-60 dark:border-zinc-800";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5">
      {/* header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={`/gmb/${clientId}?tab=website`} className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> {business}</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold text-zinc-900 sm:text-2xl dark:text-white">
            <span className="min-w-0 break-words">{site.basicInfo?.siteName || site.slug}</span>
            <Badge tone={site.isLive ? "emerald" : "slate"}>{site.isLive ? "Live" : "Draft"}</Badge>
            <Badge tone="blue">{site.pageType === "multi" ? "Multi-page" : "One page"}</Badge>
          </h1>
          {liveUrl ? <a href={liveUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 text-sm text-sky-600 hover:underline"><span className="truncate">{liveUrl}</span> <ExternalLink className="h-3.5 w-3.5 shrink-0" /></a> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {liveUrl ? <a href={liveUrl} target="_blank" rel="noreferrer"><Button variant="secondary"><Eye className="h-4 w-4" /> View site</Button></a> : null}
          {site.isLive ? (
            <Button variant="secondary" onClick={() => act("unpublish", {}, "Take this website offline?", "Website unpublished.")} disabled={Boolean(busy)}>{busy === "unpublish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />} Unpublish</Button>
          ) : (
            <Button onClick={() => act("publish", {}, null, "Website is live.")} disabled={Boolean(busy)}>{busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} Publish</Button>
          )}
        </div>
      </div>

      {/* section switcher: dropdown on phones, wrapped tabs from sm up (no dependence on page width breakpoints) */}
      <div className="sm:hidden">
        <Select value={tab} onChange={(e) => setTab(e.target.value)} aria-label="Section">
          {nav.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </Select>
      </div>
      <nav className="hidden flex-wrap gap-1 rounded-2xl border border-zinc-200 bg-white p-1.5 sm:flex dark:border-zinc-800 dark:bg-zinc-950" aria-label="Website sections">
        {nav.map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${tab === k ? "bg-brand-500 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
            <Icon className="h-4 w-4 shrink-0" /> {label}
          </button>
        ))}
      </nav>

      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

      <div className="min-w-0 space-y-5">
        {tab === "overview" ? (
          <>
            <Panel title="Quick actions" subtitle="Pull content from Google or generate images in one click">
              <div className="grid gap-3 md:grid-cols-3">
                <button type="button" onClick={() => act("refill", { mode: "fill" }, null, "Empty fields filled from Google.")} disabled={Boolean(busy)} className={actionCard}>
                  <RefreshCw className={`mt-0.5 h-5 w-5 shrink-0 text-brand-500 ${busy === "refill" ? "animate-spin" : ""}`} />
                  <span><span className="block text-sm font-semibold text-zinc-900 dark:text-white">Fill from Google</span><span className="mt-0.5 block text-xs text-zinc-500">Fills empty fields only - your edits stay.</span></span>
                </button>
                <button type="button" onClick={() => act("ai_images", {}, "Generate AI images for the hero, about and every service? Uses AI credits and replaces those images.", "AI images are being generated - you'll get a notification in 1-2 minutes.")} disabled={Boolean(busy)} className={actionCard}>
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
                  <span><span className="block text-sm font-semibold text-zinc-900 dark:text-white">Generate AI images</span><span className="mt-0.5 block text-xs text-zinc-500">Hero, about and one photo per service.</span></span>
                </button>
                <button type="button" onClick={() => act("refill", { mode: "overwrite" }, "Replace text, services, reviews, contact and SEO with the latest Google data? Your manual edits to those will be overwritten.", "Website reset to Google data.")} disabled={Boolean(busy)} className={actionCard}>
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
                  <span><span className="block text-sm font-semibold text-zinc-900 dark:text-white">Reset to Google</span><span className="mt-0.5 block text-xs text-zinc-500">Overwrites your content with Google data.</span></span>
                </button>
              </div>
            </Panel>
            <Panel title="Theme" subtitle="Change the design - content stays">
              {!themes ? <Skeleton className="h-32" /> : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {themes.filter((t) => t.pageType === site.pageType).map((t) => {
                    const active = String(site.theme?._id || site.theme) === String(t.id);
                    return (
                      <button key={t.id} type="button" onClick={() => changeTheme(t.id)} disabled={busy === "theme"} className={`overflow-hidden rounded-2xl border-2 text-left transition ${active ? "border-brand-500" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800"}`}>
                        <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-800">
                          {t.previewImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.previewImage} alt="" className="h-full w-full object-cover object-top" />
                          ) : <div className="flex h-full items-center justify-center text-zinc-300"><LayoutTemplate className="h-8 w-8" /></div>}
                        </div>
                        <div className="flex items-center justify-between gap-2 p-2.5">
                          <p className="truncate text-sm font-semibold">{t.name}</p>
                          {active ? <Badge tone="emerald">Current</Badge> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-zinc-400">Only {site.pageType === "multi" ? "multi-page" : "one-page"} themes can be swapped in. To switch type, create a new website.</p>
            </Panel>
            <Panel title="Danger zone" subtitle="Deleting removes pages, images and form leads for good">
              <Button variant="dangerGhost" onClick={() => act("delete", {}, `Delete ${site.slug} permanently? Pages, images and form leads are removed.`)} disabled={Boolean(busy)}><Trash2 className="h-4 w-4" /> Delete website</Button>
            </Panel>
          </>
        ) : null}

        {tab === "brand" ? (
          <Panel title="Brand & logo" subtitle="Name, tagline, logo, favicon and colours">
            {obj("basicInfo", (v, set) => (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {f(v, set, "siteName", "Website name")}
                  {f(v, set, "tagline", "Tagline")}
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <ImageField label="Logo" value={v.logo} onChange={(x) => set({ logo: x })} upload={upload} aspect="aspect-[3/1]" />
                  <ImageField label="Favicon" value={v.favicon} onChange={(x) => set({ favicon: x })} upload={upload} aspect="aspect-square max-w-[120px]" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {["primaryColor", "secondaryColor"].map((k) => (
                    <label key={k} className="block">
                      <Label>{prettyKey(k)}</Label>
                      <div className="flex gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(v[k] || "") ? v[k] : "#000000"} onChange={(e) => set({ [k]: e.target.value })} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-700" /><Input value={v[k] || ""} onChange={(e) => set({ [k]: e.target.value })} /></div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </Panel>
        ) : null}

        {tab === "hero" ? (
          <>
            <Panel title="Hero slides" subtitle="The first screen visitors see">
              <ArrayEditor items={site.heroSlides} kind="hero" call={call} wid={wid} onSaved={saved} newItem={{ title: "", subtitle: "", ctaText: "Call now", ctaLink: "#contact", isActive: true }}
                fields={[["title", "Title"], ["subtitle", "Subtitle", "textarea"], ["ctaText", "Button text"], ["ctaLink", "Button link"], ["isActive", "Show this slide", "bool"]]} />
            </Panel>
            <Panel title="Hero settings" subtitle="Overlay over the slide image and the enquiry form">
              {obj("heroSettings", (v, set) => (
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block"><Label>Overlay style</Label><Select value={v.overlayStyle || "gradient"} onChange={(e) => set({ overlayStyle: e.target.value })}>{["gradient", "solid", "none"].map((o) => <option key={o} value={o}>{prettyKey(o)}</option>)}</Select></label>
                  <label className="block"><Label hint={`${v.overlayOpacity ?? 60}%`}>Overlay opacity</Label><input type="range" min={0} max={100} value={v.overlayOpacity ?? 60} onChange={(e) => set({ overlayOpacity: Number(e.target.value) })} className="mt-3 w-full accent-brand-500" /></label>
                  <div className="md:pt-6"><Switch label="Show enquiry form" checked={v.showForm !== false} onChange={(x) => set({ showForm: x })} /></div>
                </div>
              ))}
            </Panel>
          </>
        ) : null}

        {tab === "about" ? (
          <Panel title="About" subtitle="Who the business is">
            {obj("about", (v, set) => (
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
                <div className="space-y-4">
                  {f(v, set, "heading", "Heading")}
                  {f(v, set, "shortText", "Short text", "textarea")}
                  {f(v, set, "longText", "Full text", "textarea")}
                  <label className="block"><Label hint="one per line">Highlights</Label><Textarea rows={4} value={(v.highlights || []).join("\n")} onChange={(e) => set({ highlights: e.target.value.split("\n") })} /></label>
                </div>
                <div className="max-w-[260px]"><ImageField label="Image" value={v.image} onChange={(x) => set({ image: x })} upload={upload} aspect="aspect-[4/5]" /></div>
              </div>
            ))}
          </Panel>
        ) : null}

        {tab === "services" ? (
          <Panel title="Services" subtitle="Each service shows on the website with its description, price and image">
            <ArrayEditor items={site.services} kind="services" call={call} wid={wid} onSaved={saved} newItem={{ title: "", description: "", price: "", isActive: true }}
              fields={[["title", "Service name"], ["price", "Price (text)"], ["description", "Description", "textarea"], ["isActive", "Show on website", "bool"]]} />
          </Panel>
        ) : null}

        {tab === "reviews" ? (
          <Panel title="Reviews" subtitle="Testimonials shown on the website">
            <ArrayEditor items={site.reviews} kind="reviews" imageField="avatar" call={call} wid={wid} onSaved={saved} newItem={{ name: "", rating: 5, text: "", designation: "Google review", isApproved: true }}
              fields={[["name", "Name"], ["designation", "Label"], ["rating", "Rating", "rating"], ["text", "Review", "textarea"], ["isApproved", "Show on website", "bool"]]} />
          </Panel>
        ) : null}

        {tab === "contact" ? (
          <Panel title="Contact" subtitle="Address, phone, hours and map">
            {obj("contact", (v, set) => (
              <div className="grid gap-4 md:grid-cols-2">
                {f(v, set, "heading", "Heading")}
                {f(v, set, "phone", "Phone")}
                {f(v, set, "email", "Email")}
                {f(v, set, "workingHours", "Opening hours")}
                <div className="md:col-span-2">{f(v, set, "address", "Address", "textarea")}</div>
                <div className="md:col-span-2">{f(v, set, "mapEmbedUrl", "Google Map embed URL", "text", "from Google Maps → Share → Embed")}</div>
                {v.mapEmbedUrl ? <iframe title="Map" src={v.mapEmbedUrl} className="h-56 w-full rounded-xl border-0 sm:h-72 md:col-span-2" loading="lazy" /> : null}
              </div>
            ))}
          </Panel>
        ) : null}

        {tab === "footer" ? (
          <Panel title="Footer & social links" subtitle="Bottom of every page">
            {obj("footer", (v, set) => (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">{f(v, set, "tagline", "Footer tagline")}{f(v, set, "copyrightText", "Copyright line")}</div>
                <div>
                  <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Social links</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {["facebook", "instagram", "twitter", "linkedin", "youtube", "whatsapp", "website"].map((k) => (
                      <label key={k} className="block"><Label>{prettyKey(k)}</Label><Input placeholder="https://" value={v.socialLinks?.[k] || ""} onChange={(e) => set({ socialLinks: { ...(v.socialLinks || {}), [k]: e.target.value } })} /></label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </Panel>
        ) : null}

        {tab === "seo" ? (
          <Panel title="SEO" subtitle="How the site appears on Google">
            {obj("seo", (v, set) => (
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0 space-y-4">
                  {f(v, set, "title", "Page title", "text", `${(v.title || "").length}/70`)}
                  {f(v, set, "description", "Meta description", "textarea", `${(v.description || "").length}/160`)}
                  <label className="block"><Label hint="comma separated">Keywords</Label><Input value={(v.keywords || []).join(", ")} onChange={(e) => set({ keywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></label>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">Google preview</p>
                    <div className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="truncate text-xs text-emerald-700 dark:text-emerald-400">{liveUrl || site.slug}</p>
                      <p className="truncate text-base text-[#1a0dab] dark:text-sky-400">{v.title || site.basicInfo?.siteName}</p>
                      <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{v.description || "Add a meta description…"}</p>
                    </div>
                  </div>
                </div>
                <div className="max-w-[320px]"><ImageField label="Share image (og:image)" value={v.ogImage} onChange={(x) => set({ ogImage: x })} upload={upload} /></div>
              </div>
            ))}
          </Panel>
        ) : null}

        {tab === "visibility" ? (
          <Panel title="Show / hide sections" subtitle="Turn whole sections of the one-page site on or off">
            {obj("sections", (v, set) => (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Object.keys(v).filter((k) => typeof v[k] === "boolean").map((k) => <Switch key={k} label={prettyKey(k)} checked={v[k]} onChange={(x) => set({ [k]: x })} />)}
              </div>
            ))}
          </Panel>
        ) : null}

        {tab === "pages" ? (
          <Panel title="Pages & sections" subtitle="Pick a page, then edit, reorder, hide or add its blocks">
            <PagesEditor pages={pages} call={call} upload={upload} reload={load} />
          </Panel>
        ) : null}

        {tab === "leads" ? (
          <Panel title="Form leads" subtitle="Enquiries sent from the website's contact forms">
            {!leads ? <Skeleton className="h-32" /> : leads.length ? (
              <ul className="-my-1 divide-y divide-zinc-100 dark:divide-zinc-800">
                {leads.map((l) => (
                  <li key={l._id} className="py-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white"><Mail className="h-4 w-4 shrink-0 text-zinc-400" /> {l.name || "Visitor"} {!l.isRead ? <Badge tone="amber">New</Badge> : null}</p>
                      <p className="text-xs text-zinc-400">{l.createdAt ? new Date(l.createdAt).toLocaleString("en-IN") : ""}</p>
                    </div>
                    {l.phone || l.email ? (
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {l.phone ? <a href={`tel:${l.phone}`} className="text-sky-600 hover:underline">{l.phone}</a> : null}
                        {l.email ? <a href={`mailto:${l.email}`} className="break-all text-sky-600 hover:underline">{l.email}</a> : null}
                      </p>
                    ) : null}
                    <p className="mt-2 whitespace-pre-line break-words text-zinc-600 dark:text-zinc-300">{l.message || JSON.stringify(l.data || {})}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-center dark:border-zinc-700">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">No enquiries yet</p>
                <p className="mt-1 text-sm text-zinc-500">Messages from the website&apos;s contact forms land here.</p>
              </div>
            )}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}