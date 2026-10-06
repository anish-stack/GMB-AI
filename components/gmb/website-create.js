"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  Sparkles,
  XCircle,
  Eye,
  X,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
} from "lucide-react";
import { Button, Input, Alert, Skeleton, Badge, Card } from "@/components/ui";
import { apiFetch } from "@/lib/hooks/use-api";

const DEFAULT_PAGE_SIZE = 6;
const PAGE_SIZES = [6, 12, 24];
const FRAME_W = 1600;
const FRAME_H = 1000;

/* ---------- helpers ---------- */

/** Page list with ellipsis, e.g. [1, "...", 4, 5, 6, "...", 12] */
function buildPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push("...");
    out.push(n);
  });
  return out;
}

/** Scales a fixed-size desktop iframe down to fit its parent width. */
function ScaledFrame({ src, title }) {
  const frameRef = useRef(null);

  useEffect(() => {
    const el = frameRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const apply = () =>
      el.style.setProperty("--s", String(parent.clientWidth / FRAME_W));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={title}
      loading="lazy"
      tabIndex={-1}
      sandbox="allow-scripts"
      className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
      style={{
        width: FRAME_W,
        height: FRAME_H,
        transform: "scale(var(--s, 0.2))",
      }}
    />
  );
}

function StepHeader({ n, title, hint }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-900">
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          {title}
        </h2>
        {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
      </div>
    </div>
  );
}

/* ---------- preview modal ---------- */

function ThemePreviewModal({ t, onClose, onPick, active }) {
  const [device, setDevice] = useState("desktop");
  const widths = { desktop: "100%", tablet: "768px", mobile: "390px" };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${t.name} preview`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-3 sm:px-4 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
              {t.name}
            </p>
            {t.description ? (
              <p className="truncate text-xs text-zinc-500">{t.description}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden overflow-hidden rounded-lg border border-zinc-200 sm:flex dark:border-zinc-700">
              {[
                ["desktop", Monitor],
                ["tablet", Tablet],
                ["mobile", Smartphone],
              ].map(([k, Icon]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDevice(k)}
                  aria-pressed={device === k}
                  className={`p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 ${
                    device === k
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                  title={k}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <a
              href={t.previewImage}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => {
                onPick();
                onClose();
              }}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
            >
              {active ? "Selected" : "Use this theme"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 justify-center overflow-auto bg-zinc-100 dark:bg-zinc-950">
          <iframe
            src={t.previewImage}
            title={t.name}
            sandbox="allow-scripts"
            className="h-full border-0 bg-white transition-all duration-300"
            style={{ width: widths[device], maxWidth: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- theme card ---------- */

function ThemeCard({ t, active, onPick }) {
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const isHtml = /\.html?(\?|#|$)/i.test(t.previewImage || "");

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={active}
        onClick={onPick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPick();
          }
        }}
        className={`group flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-zinc-900 ${
          active
            ? "border-brand-500 shadow-lg shadow-red-500/10"
            : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
        }`}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
          {t.previewImage && !broken ? (
            isHtml ? (
              <>
                <ScaledFrame src={t.previewImage} title={t.name} />
                <span className="absolute inset-0" />
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.previewImage}
                alt=""
                loading="lazy"
                onError={() => setBroken(true)}
                className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
              />
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-400">
              <LayoutTemplate className="h-8 w-8" />
              <span className="text-[11px]">{t.themeKey}</span>
            </div>
          )}

          {t.previewImage ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
              className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur transition focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
          ) : null}

          {active ? (
            <span className="absolute right-2 top-2 z-10 rounded-full bg-brand-500 p-1 text-white shadow">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p
              className="truncate text-sm font-semibold text-zinc-900 dark:text-white"
              title={t.name}
            >
              {t.name}
            </p>
            <Badge tone={t.pageType === "multi" ? "violet" : "blue"}>
              {t.pageType === "multi" ? "Multi-page" : "One page"}
            </Badge>
          </div>
          {t.description ? (
            <p className="line-clamp-2 text-xs text-zinc-500">
              {t.description}
            </p>
          ) : null}
        </div>
      </div>

      {open ? (
        <ThemePreviewModal
          t={t}
          active={active}
          onPick={onPick}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/* ---------- pagination ---------- */

function Pagination({
  page,
  totalPages,
  total,
  from,
  to,
  pageSize,
  onPage,
  onPageSize,
}) {
  const pages = buildPages(page, totalPages);
  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500";

  return (
    <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-zinc-100 pt-4 sm:flex-row dark:border-zinc-800">
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span>
          Showing {from}-{to} of {total}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="sr-only sm:not-sr-only">Per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 ? (
        <nav aria-label="Theme pages" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            aria-label="Previous page"
            className={`${btn} text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-zinc-400">
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-current={p === page ? "page" : undefined}
                className={`${btn} ${
                  p === page
                    ? "bg-brand-500 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page === totalPages}
            aria-label="Next page"
            className={`${btn} text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}

/* ---------- image option ---------- */

function ImageOption({ selected, disabled, onSelect, icon: Icon, title, text }) {
  return (
    <label
      className={`block rounded-2xl border-2 p-4 transition focus-within:outline focus-within:outline-2 focus-within:outline-brand-500 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${
        selected
          ? "border-brand-500 bg-red-50/40 dark:bg-red-950/10"
          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
      }`}
    >
      <input
        type="radio"
        name="img"
        className="sr-only"
        disabled={disabled}
        checked={selected}
        onChange={onSelect}
      />
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          {Icon}
          {title}
        </p>
        {selected ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-500" />
        ) : null}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{text}</p>
    </label>
  );
}

/* ---------- page ---------- */

/** Separate page: /gmb/:id/website/new */
export function CreateWebsitePage({ clientId, business, subtitle }) {
  const router = useRouter();
  const [themes, setThemes] = useState(null);
  const [pre, setPre] = useState(null);
  const [ai, setAi] = useState(null);
  const [theme, setTheme] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [slug, setSlug] = useState("");
  const [slugState, setSlugState] = useState(null);
  const [images, setImages] = useState("manual");
  const [fill, setFill] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const gridTop = useRef(null);

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
      setSlugState(
        await apiFetch(`/api/gmb/${clientId}/website`, {
          body: { action: "check_slug", slug: v },
        }),
      );
    } catch {
      /* ignore */
    }
  }

  async function create() {
    setBusy(true);
    setErr("");
    try {
      const r = await apiFetch(`/api/gmb/${clientId}/website`, {
        body: {
          action: "create_from_gmb",
          theme_id: theme,
          slug: slugState?.slug || slug,
          images: fill ? images : "manual",
          fill,
        },
      });
      router.push(`/gmb/${clientId}/website/${r.site.id}`);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  const filtered = useMemo(
    () =>
      (themes || []).filter((t) => filter === "all" || t.pageType === filter),
    [themes, filter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const shown = filtered.slice(start, start + pageSize);

  function goPage(p) {
    setPage(Math.min(Math.max(1, p), totalPages));
    gridTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function changeFilter(k) {
    setFilter(k);
    setPage(1);
  }
  function changePageSize(n) {
    setPageSize(n);
    setPage(1);
  }

  const chosen = themes?.find((t) => t.id === theme);
  const filled = pre
    ? [
        ["Business name & tagline", pre.basicInfo?.siteName],
        ["Logo", pre.basicInfo?.logo],
        [
          `Google photos (${pre.hero?.images?.length || 0})`,
          pre.hero?.images?.length,
        ],
        ["About text", pre.about?.longText],
        [`Services (${pre.services?.length || 0})`, pre.services?.length],
        [`Google reviews (${pre.reviews?.length || 0})`, pre.reviews?.length],
        ["Address, phone & map", pre.contact?.address || pre.contact?.phone],
        ["Opening hours", pre.contact?.workingHours],
        ["Social links", Object.values(pre.socialLinks || {}).some(Boolean)],
        ["SEO title, description & keywords", pre.seo?.title],
      ]
    : [];
  const filledCount = filled.filter(([, ok]) => ok).length;
  const ready = theme && slugState?.available && !busy;
  const imageMode = fill ? images : "manual";

  const createLabel = (
    <>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}{" "}
      Create & fill website
    </>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-28 xl:pb-0">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/gmb/${clientId}?tab=website`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {business}
          </Link>
          <h1 className="mt-1 text-xl font-bold text-zinc-900 sm:text-2xl dark:text-white">
            Create website from Google
          </h1>
          <p className="truncate text-sm text-zinc-500">
            {business}
            {subtitle ? ` · ${subtitle}` : ""}
          </p>
        </div>
        <Button
          onClick={create}
          disabled={!ready}
          className="hidden sm:inline-flex"
        >
          {createLabel}
        </Button>
      </div>

      {err ? <Alert>{err}</Alert> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* 1. theme */}
          <Card className="p-4 sm:p-6">
            <div ref={gridTop} className="scroll-mt-4" />
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <StepHeader
                n={1}
                title="Choose a theme"
                hint={
                  themes
                    ? `${filtered.length} theme${filtered.length === 1 ? "" : "s"} available`
                    : "Loading themes..."
                }
              />
              <div
                role="tablist"
                aria-label="Theme type"
                className="flex w-full gap-1 rounded-xl bg-zinc-100 p-1 text-xs sm:w-auto dark:bg-zinc-800"
              >
                {[
                  ["all", "All"],
                  ["single", "One page"],
                  ["multi", "Multi-page"],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={filter === k}
                    onClick={() => changeFilter(k)}
                    className={`flex-1 rounded-lg px-3 py-1.5 font-semibold transition sm:flex-none ${
                      filter === k
                        ? "bg-white shadow-sm dark:bg-zinc-900 dark:text-white"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {!themes ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: DEFAULT_PAGE_SIZE }, (_, i) => (
                  <Skeleton key={i} className="aspect-[16/13]" />
                ))}
              </div>
            ) : shown.length ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((t) => (
                    <ThemeCard
                      key={t.id}
                      t={t}
                      active={theme === t.id}
                      onPick={() => setTheme(t.id)}
                    />
                  ))}
                </div>
                <Pagination
                  page={safePage}
                  totalPages={totalPages}
                  total={filtered.length}
                  from={start + 1}
                  to={start + shown.length}
                  pageSize={pageSize}
                  onPage={goPage}
                  onPageSize={changePageSize}
                />
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
                No themes match this filter. Try &ldquo;All&rdquo;.
              </p>
            )}
          </Card>

          {/* 2. address */}
          <Card className="p-4 sm:p-6">
            <StepHeader
              n={2}
              title="Web address"
              hint="3-40 letters, numbers and dashes"
            />
            <div className="flex max-w-xl items-center gap-2">
              <Input
                value={slug}
                onChange={(e) =>
                  check(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  )
                }
                maxLength={40}
                aria-label="Web address"
              />
              {slugState ? (
                slugState.available ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-rose-500" />
                )
              ) : null}
            </div>
            {slugState?.url ? (
              <p className="mt-2 break-all text-xs text-zinc-500">
                {slugState.available ? (
                  <>
                    Your site: <b>{slugState.url}</b>
                  </>
                ) : (
                  `${slugState.url} is taken - try another`
                )}
              </p>
            ) : null}
          </Card>

          {/* 3. content + images */}
          <Card className="p-4 sm:p-6">
            <StepHeader n={3} title="Content and images" />

            <div className="flex items-start justify-between gap-4 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Fill with Google Business Profile data
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Turn off to start from the theme&apos;s blank template and
                  write everything yourself.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={fill}
                aria-label="Fill with Google Business Profile data"
                onClick={() => setFill((v) => !v)}
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                  fill ? "bg-brand-500" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    fill ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <div
              className={`mt-4 grid gap-3 md:grid-cols-2 ${fill ? "" : "pointer-events-none opacity-50"}`}
              aria-disabled={!fill}
            >
              <ImageOption
                selected={imageMode === "manual"}
                disabled={!fill}
                onSelect={() => setImages("manual")}
                icon={<ImageIcon className="h-4 w-4" />}
                title="Google photos + manual"
                text="Uses the listing's Google photos where available. Upload the rest yourself in the builder. No credits."
              />
              <ImageOption
                selected={imageMode === "ai"}
                disabled={!fill || !ai?.available}
                onSelect={() => setImages("ai")}
                icon={<Sparkles className="h-4 w-4 text-brand-500" />}
                title="Generate with AI"
                text={
                  ai?.available
                    ? `${ai.images} images - hero, about and one per service${ai.credits ? ` · ${ai.credits} credits` : ""}. Made in the background (~1-2 min); you get a notification.`
                    : "No AI image provider configured (Gemini / OpenAI / Hugging Face)."
                }
              />
            </div>
            {!fill ? (
              <p className="mt-2 text-xs text-zinc-500">
                Image options apply only when Google data is used.
              </p>
            ) : null}
          </Card>
        </div>

        {/* summary */}
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4">
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                Filled from Google
              </p>
              {pre ? (
                <span className="text-xs font-semibold text-zinc-500">
                  {filledCount}/{filled.length}
                </span>
              ) : null}
            </div>
            {!pre ? (
              <Skeleton className="h-48" />
            ) : (
              <ul
                className={`grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-1 ${fill ? "" : "opacity-40"}`}
              >
                {filled.map(([label, ok]) => (
                  <li
                    key={label}
                    className={`flex items-center gap-2 ${ok ? "text-zinc-700 dark:text-zinc-200" : "text-zinc-400"}`}
                  >
                    {ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span className="min-w-0">{label}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
              Missing items stay as theme placeholders - edit them in the
              builder. Use &ldquo;Sync with Google&rdquo; first for the latest
              data.
            </p>
          </Card>

          <Card className="hidden space-y-3 p-4 text-sm sm:p-5 xl:block">
            <p className="font-semibold text-zinc-900 dark:text-white">
              Summary
            </p>
            <dl className="space-y-2 text-zinc-600 dark:text-zinc-300">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Theme</dt>
                <dd className="truncate font-semibold">{chosen?.name || "-"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Address</dt>
                <dd className="break-all text-right font-semibold">
                  {slugState?.url || "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Content</dt>
                <dd className="font-semibold">
                  {fill ? "Google data" : "Blank template"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Images</dt>
                <dd className="font-semibold">
                  {imageMode === "ai" ? "AI generated" : "Google + manual"}
                </dd>
              </div>
            </dl>
            <Button
              className="mt-1 w-full justify-center"
              onClick={create}
              disabled={!ready}
            >
              {createLabel}
            </Button>
          </Card>
        </aside>
      </div>

      {/* mobile / tablet sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur xl:hidden dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-semibold text-zinc-900 dark:text-white">
              {chosen?.name || "No theme selected"}
            </p>
            <p className="truncate text-zinc-500">
              {slugState?.available
                ? slugState.url
                : "Pick an available web address"}
            </p>
          </div>
          <Button onClick={create} disabled={!ready}>
            {createLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}