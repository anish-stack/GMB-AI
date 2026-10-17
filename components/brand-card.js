"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Save, Tag, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Button, Input, Alert, Skeleton } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { useBrand } from "@/components/brand";

/** Settings -> Your brand (white-label): name + logo shown instead of the platform's. */
export function BrandCard({ canEdit }) {
  const router = useRouter();
  const brand = useBrand();
  const { data, loading, mutate } = useApi("/api/settings/brand");
  const [name, setName] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const file = useRef(null);
  const value = name ?? data?.brand_name ?? "";

  async function saveName() {
    setBusy("name");
    setMsg(null);
    try {
      mutate({ ...data, ...(await apiFetch("/api/settings/brand", { method: "PUT", body: { brand_name: value } })) });
      setName(null);
      setMsg({ tone: "green", text: value ? `Your panel now shows “${value}”.` : `Back to ${brand.platformName || "the platform name"}.` });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }
  async function upload(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("logo");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/settings/brand", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Upload failed");
      mutate({ ...data, brand_logo_url: j.brand_logo_url });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "red", text: err.message });
    } finally {
      setBusy("");
    }
  }
  async function removeLogo() {
    setBusy("rm");
    try {
      mutate({ ...data, ...(await apiFetch("/api/settings/brand", { method: "DELETE" })) });
      router.refresh();
    } finally {
      setBusy("");
    }
  }
  if (loading && !data) return <Skeleton className="h-40" />;
  return (
    <Card>
      <CardHeader title="Your brand (white-label)" subtitle="Show your agency's name and logo instead of the platform's - in this panel, emails, PDF reports and client-facing pages." />
      <CardBody className="grid gap-5 md:grid-cols-[160px_1fr]">
        <div>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
            {data?.brand_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.brand_logo_url} alt="Logo" className="h-full w-full object-contain p-2" />
            ) : <Tag className="h-8 w-8 text-zinc-300" />}
          </div>
          {canEdit ? (
            <div className="mt-2 flex gap-1">
              <Button variant="secondary" className="flex-1 justify-center !py-1.5 text-xs" onClick={() => file.current?.click()} disabled={Boolean(busy)}>
                {busy === "logo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} {data?.brand_logo_url ? "Replace" : "Upload"}
              </Button>
              {data?.brand_logo_url ? <Button variant="dangerGhost" className="!px-2 !py-1.5" onClick={removeLogo} disabled={Boolean(busy)} aria-label="Remove logo"><Trash2 className="h-3.5 w-3.5" /></Button> : null}
            </div>
          ) : null}
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} />
          <p className="mt-1 text-[11px] text-zinc-400">Square PNG/JPG, max 1 MB</p>
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Brand name
            <div className="mt-1 flex gap-2">
              <Input value={value} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={brand.platformName || "e.g. XYZ Digital"} disabled={!canEdit} />
              <Button onClick={saveName} disabled={!canEdit || Boolean(busy) || value === (data?.brand_name || "")}>{busy === "name" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
            </div>
          </label>
          <p className="text-xs text-zinc-500">Leave empty to use {brand.platformName || "the platform name"}. Your team sees it in the sidebar and browser tab; your clients see it on reports, review pages and emails.</p>
          {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        </div>
      </CardBody>
    </Card>
  );
}
