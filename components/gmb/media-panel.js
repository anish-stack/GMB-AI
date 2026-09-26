"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { ExternalLink, Image as ImageIcon, Images, Link2, Loader2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { Card, Button, Field, Input, Select, Alert, Skeleton, EmptyState, PanelHeader, Modal } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/hooks/use-api";

export const MEDIA_CATEGORIES = [
  { value: "COVER", label: "Cover", size: "1200 × 900" },
  { value: "PROFILE", label: "Profile / Logo", size: "720 × 720" },
  { value: "EXTERIOR", label: "Exterior", size: "1200 × 900" },
  { value: "INTERIOR", label: "Interior", size: "1200 × 900" },
  { value: "PRODUCT", label: "Product", size: "1080 × 1080" },
  { value: "AT_WORK", label: "At work", size: "1200 × 900" },
  { value: "FOOD_AND_DRINK", label: "Food & drink", size: "1080 × 1080" },
  { value: "MENU", label: "Menu", size: "1080 × 1350" },
  { value: "COMMON_AREA", label: "Common area", size: "1200 × 900" },
  { value: "ROOMS", label: "Rooms", size: "1200 × 900" },
  { value: "TEAMS", label: "Team", size: "1200 × 900" },
  { value: "ADDITIONAL", label: "Additional", size: "1080 × 1080" },
];
const META = Object.fromEntries(MEDIA_CATEGORIES.map((c) => [c.value, c]));
const meta = (c) => META[c] || META.ADDITIONAL;
const MAX_MB = 10;

const MediaTile = memo(function MediaTile({ item, deleting, onDelete }) {
  const m = meta(item.category);
  const src = item.thumbnailUrl || item.googleUrl;
  return (
    <figure className="group overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={item.description || m.label} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center"><ImageIcon className="h-7 w-7 text-zinc-400" /></span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{m.label}</span>
        <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          {item.googleUrl ? (
            <a href={item.googleUrl} target="_blank" rel="noreferrer" aria-label="Open" className="rounded-lg bg-white/90 p-1.5 text-zinc-700 shadow hover:bg-white">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          <button type="button" onClick={onDelete} disabled={deleting} aria-label="Delete" className="rounded-lg bg-white/90 p-1.5 text-rose-600 shadow hover:bg-white disabled:opacity-50">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {item.description ? <figcaption className="line-clamp-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">{item.description}</figcaption> : null}
    </figure>
  );
});

function AddMediaModal({ clientId, open, onClose, onAdded }) {
  const [mode, setMode] = useState("file");
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("ADDITIONAL");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preview = useMemo(() => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function pick(f) {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) return setError(`File is larger than ${MAX_MB} MB.`);
    setError("");
    setFile(f);
  }

  function close() {
    if (busy) return;
    setFile(null);
    setUrl("");
    setDescription("");
    setError("");
    onClose();
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      let body;
      if (mode === "file") {
        if (!file) throw new Error("Choose a file first.");
        body = new FormData();
        body.append("file", file);
        body.append("category", category);
        if (description.trim()) body.append("description", description.trim());
      } else {
        if (!/^https?:\/\//i.test(url.trim())) throw new Error("Enter a valid public image URL.");
        body = { sourceUrl: url.trim(), category, description: description.trim() || null, mediaFormat: "PHOTO" };
      }
      await apiFetch(`/api/gmb/${clientId}/media`, { body });
      setBusy(false);
      close();
      onAdded();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add photo to Google"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {[["file", "Upload file", Upload], ["url", "From URL", Link2]].map(([v, label, Icon]) => (
            <button key={v} type="button" onClick={() => setMode(v)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${mode === v ? "bg-white shadow-sm dark:bg-zinc-900 dark:text-white" : "text-zinc-500"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {mode === "file" ? (
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-5 text-center hover:border-[#F53236] dark:border-zinc-700"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="max-h-40 rounded-lg object-contain" />
            ) : (
              <Upload className="h-6 w-6 text-zinc-400" />
            )}
            <span className="text-xs text-zinc-600 dark:text-zinc-300">{file ? file.name : "Tap to choose or drop an image / video"}</span>
            <span className="text-[11px] text-zinc-400">JPG, PNG, MP4 or MOV · max {MAX_MB} MB</span>
            <input type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        ) : (
          <Field label="Public image URL" hint="Google must be able to download it (no login, no redirects).">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." inputMode="url" />
          </Field>
        )}

        <Field label="Category" hint={`Recommended size: ${meta(category).size}`}>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {MEDIA_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="Description (optional)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="e.g. Reception area" />
        </Field>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    </Modal>
  );
}

export function MediaPanel({ clientId }) {
  const { data, error, loading, reload, mutate } = useApi(`/api/gmb/${clientId}/media`);
  const [filter, setFilter] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [actionError, setActionError] = useState("");

  const items = useMemo(() => data?.items || [], [data]);
  const counts = useMemo(() => items.reduce((a, i) => ({ ...a, [i.category || "ADDITIONAL"]: (a[i.category || "ADDITIONAL"] || 0) + 1 }), {}), [items]);
  const shown = filter === "ALL" ? items : items.filter((i) => (i.category || "ADDITIONAL") === filter);
  const missing = ["COVER", "PROFILE", "EXTERIOR", "INTERIOR"].filter((c) => !counts[c]);

  async function remove(item) {
    if (!window.confirm("Delete this photo from the Google Business Profile?")) return;
    setDeleting(item.id);
    setActionError("");
    try {
      await apiFetch(`/api/gmb/${clientId}/media/${encodeURIComponent(item.name || item.id)}`, { method: "DELETE" });
      mutate((d) => ({ ...d, items: (d?.items || []).filter((m) => m.id !== item.id) }));
    } catch (e) {
      setActionError(e.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={Images}
        tone="violet"
        title="Photos & media"
        subtitle="Listings with fresh photos get more calls and direction requests"
        count={items.length || null}
        actions={
          <>
            <Button variant="secondary" onClick={reload} disabled={loading} aria-label="Refresh">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add photo</Button>
          </>
        }
      />
      <div className="space-y-4 p-4 sm:p-5">
        {error || actionError ? <Alert>{actionError || error}</Alert> : null}
        {!loading && missing.length ? (
          <Alert tone="amber">Missing key photos: {missing.map((c) => meta(c).label).join(", ")}. Add them to complete the profile.</Alert>
        ) : null}

        {items.length ? (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {[["ALL", `All · ${items.length}`], ...Object.entries(counts).map(([k, n]) => [k, `${meta(k).label} · ${n}`])].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFilter(k)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${filter === k ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-white dark:text-zinc-900" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800"}`}>
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {loading && !items.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}</div>
        ) : shown.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {shown.map((item) => <MediaTile key={item.id} item={item} deleting={deleting === item.id} onDelete={() => remove(item)} />)}
          </div>
        ) : (
          <EmptyState icon={Images} title="No photos yet" text="Upload a cover, logo, and a few interior/exterior shots." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add photo</Button>} />
        )}
      </div>
      <AddMediaModal clientId={clientId} open={open} onClose={() => setOpen(false)} onAdded={reload} />
    </Card>
  );
}
