"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ImageIcon, LayoutTemplate, Loader2, Sparkles, XCircle } from "lucide-react";
import { Button, Input, Alert, Skeleton, Badge, Card } from "@/components/ui";
import { apiFetch } from "@/lib/hooks/use-api";

function ThemeCard({ t, active, onPick }) {
  const [broken, setBroken] = useState(false);
  return (
    <button type="button" onClick={onPick}
      className={`group overflow-hidden rounded-2xl border-2 bg-white text-left transition dark:bg-zinc-900 ${active ? "border-[#F53236] shadow-lg shadow-red-500/10" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800"}`}>
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
        {t.previewImage && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.previewImage} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-400">
            <LayoutTemplate className="h-8 w-8" />
            <span className="text-[11px]">{t.themeKey}</span>
          </div>
        )}
        {active ? <span className="absolute right-2 top-2 rounded-full bg-[#F53236] p-1 text-white"><CheckCircle2 className="h-4 w-4" /></span> : null}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white" title={t.name}>{t.name}</p>
        <Badge tone={t.pageType === "multi" ? "violet" : "blue"}>{t.pageType === "multi" ? "Multi-page" : "One page"}</Badge>
      </div>
      {t.description ? <p className="line-clamp-2 px-3 pb-3 text-xs text-zinc-500">{t.description}</p> : null}
    </button>
  );
}

/** Separate page: /gmb/:id/website/new */
export function CreateWebsitePage({ clientId, business, subtitle }) {
  const router = useRouter();
  const [themes, setThemes] = useState(null);
  const [pre, setPre] = useState(null);
  const [ai, setAi] = useState(null);
  const [theme, setTheme] = useState("");
  const [filter, setFilter] = useState("all");
  const [slug, setSlug] = useState("");
  const [slugState, setSlugState] = useState(null);
  const [images, setImages] = useState("manual");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiFetch(`/api/gmb/${clientId}/website`, { body: { action: "themes" } }),
      apiFetch(`/api/gmb/${clientId}/website`, { body: { action: "preview" } }),
    ])
      .then(([t, p]) => {
        if (!alive) return;
        setThemes(t.themes);
        setTheme(t.themes[0]?.id || "");
        setSlug(t.suggestedSlug);
        setSlugState(t.slugCheck);
        setPre(p.prefill);
        setAi(p.ai);
      })
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [clientId]);

  async function check(v) {
    setSlug(v);
    setSlugState(null);
    if (v.length < 3) return;
    try {
      setSlugState(await apiFetch(`/api/gmb/${clientId}/website`, { body: { action: "check_slug", slug: v } }));
    } catch {
      /* ignore */
    }
  }

  async function create() {
    setBusy(true);
    setErr("");
    try {
      const r = await apiFetch(`/api/gmb/${clientId}/website`, { body: { action: "create_from_gmb", theme_id: theme, slug: slugState?.slug || slug, images } });
      router.push(`/gmb/${clientId}/website?site=${r.site.id}${r.aiImages ? "&ai=1" : ""}`);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  const shown = (themes || []).filter((t) => filter === "all" || t.pageType === filter);
  const chosen = themes?.find((t) => t.id === theme);
  const filled = pre
    ? [
        ["Business name & tagline", pre.basicInfo?.siteName],
        ["Logo", pre.basicInfo?.logo],
        [`Google photos (${pre.hero?.images?.length || 0})`, pre.hero?.images?.length],
        ["About text", pre.about?.longText],
        [`Services (${pre.services?.length || 0})`, pre.services?.length],
        [`Google reviews (${pre.reviews?.length || 0})`, pre.reviews?.length],
        ["Address, phone & map", pre.contact?.address || pre.contact?.phone],
        ["Opening hours", pre.contact?.workingHours],
        ["Social links", Object.values(pre.socialLinks || {}).some(Boolean)],
        ["SEO title, description & keywords", pre.seo?.title],
      ]
    : [];
  const ready = theme && slugState?.available && !busy;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/gmb/${clientId}?tab=website`} className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {business}
          </Link>
          <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">Create website from Google</h1>
          <p className="text-sm text-zinc-500">{business}{subtitle ? ` · ${subtitle}` : ""}</p>
        </div>
        <Button onClick={create} disabled={!ready}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Create & fill website
        </Button>
      </div>

      {err ? <Alert>{err}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* 1. theme */}
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">1. Choose a theme</p>
              <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 text-xs dark:bg-zinc-800">
                {[["all", "All"], ["single", "One page"], ["multi", "Multi-page"]].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-lg px-3 py-1.5 font-semibold ${filter === k ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500"}`}>{l}</button>
                ))}
              </div>
            </div>
            {!themes ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-[16/12]" />)}</div>
            ) : shown.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((t) => <ThemeCard key={t.id} t={t} active={theme === t.id} onPick={() => setTheme(t.id)} />)}
              </div>
            ) : <p className="text-sm text-zinc-500">No themes available in the website builder.</p>}
          </Card>

          {/* 2. address */}
          <Card className="p-4 sm:p-5">
            <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">2. Web address</p>
            <div className="flex max-w-xl items-center gap-2">
              <Input value={slug} onChange={(e) => check(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} maxLength={40} />
              {slugState ? (slugState.available ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="h-5 w-5 shrink-0 text-rose-500" />) : null}
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              {slugState?.url ? (slugState.available ? <>Your site: <b>{slugState.url}</b></> : `${slugState.url} is taken - try another`) : "3-40 letters, numbers and dashes"}
            </p>
          </Card>

          {/* 3. images */}
          <Card className="p-4 sm:p-5">
            <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">3. Images</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={`cursor-pointer rounded-2xl border-2 p-4 ${images === "manual" ? "border-[#F53236] bg-red-50/40 dark:bg-red-950/10" : "border-zinc-200 dark:border-zinc-800"}`}>
                <input type="radio" name="img" className="sr-only" checked={images === "manual"} onChange={() => setImages("manual")} />
                <p className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white"><ImageIcon className="h-4 w-4" /> Google photos + manual</p>
                <p className="mt-1 text-xs text-zinc-500">Uses the listing&apos;s Google photos where available. Upload the rest yourself in the builder. No credits.</p>
              </label>
              <label className={`rounded-2xl border-2 p-4 ${!ai?.available ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${images === "ai" ? "border-[#F53236] bg-red-50/40 dark:bg-red-950/10" : "border-zinc-200 dark:border-zinc-800"}`}>
                <input type="radio" name="img" className="sr-only" disabled={!ai?.available} checked={images === "ai"} onChange={() => setImages("ai")} />
                <p className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white"><Sparkles className="h-4 w-4 text-[#F53236]" /> Generate with AI</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {ai?.available
                    ? `${ai.images} images - hero, about and one per service${ai.credits ? ` · ${ai.credits} credits` : ""}. Made in the background (~1-2 min); you get a notification.`
                    : "No AI image provider configured (Gemini / OpenAI / Hugging Face)."}
                </p>
              </label>
            </div>
          </Card>
        </div>

        {/* summary */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="p-4 sm:p-5">
            <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Filled automatically from Google</p>
            {!pre ? <Skeleton className="h-48" /> : (
              <ul className="space-y-2 text-sm">
                {filled.map(([label, ok]) => (
                  <li key={label} className={`flex items-center gap-2 ${ok ? "text-zinc-700 dark:text-zinc-200" : "text-zinc-400"}`}>
                    {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0" />} {label}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-zinc-400">Missing items stay as theme placeholders - edit them in the builder. Use &ldquo;Sync with Google&rdquo; first for the latest data.</p>
          </Card>
          <Card className="space-y-2 p-4 text-sm sm:p-5">
            <p className="font-semibold text-zinc-900 dark:text-white">Summary</p>
            <p className="text-zinc-600 dark:text-zinc-300">Theme: <b>{chosen?.name || "-"}</b></p>
            <p className="break-all text-zinc-600 dark:text-zinc-300">Address: <b>{slugState?.url || "-"}</b></p>
            <p className="text-zinc-600 dark:text-zinc-300">Images: <b>{images === "ai" ? "AI generated" : "Google photos + manual"}</b></p>
            <Button className="mt-2 w-full justify-center" onClick={create} disabled={!ready}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Create & fill website
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
