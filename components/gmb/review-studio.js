"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Download, ExternalLink, Loader2, Plus, Printer, RotateCcw, Save, Star, Trash2, X } from "lucide-react";
import { Card, Button, Input, Alert, Skeleton, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

const ACCENTS = ["#0EA5E9", "#2563EB", "#4F46E5", "#7C3AED", "#DB2777", "#E11D48", "#EA580C", "#CA8A04", "#65A30D", "#059669", "#0D9488", "#18181B"];
const STYLES = [
  ["vibrant", "Vibrant", "Brand gradient, white text"],
  ["minimal", "Minimal", "White, thick brand border"],
  ["midnight", "Midnight", "Dark, high contrast"],
  ["cream", "Cream", "Warm paper, double border"],
];
const DEFAULT_STEPS = [
  { id: "liked", title: "What did you enjoy most about your visit?", options: ["Friendly staff", "Great service", "Clean place", "Professional team", "Quick service", "Quality work"] },
  { id: "highlights", title: "Any specific highlight?", options: ["Expert advice", "Fair pricing", "Great communication", "Attention to detail", "On-time", "Easy booking"] },
];
const MAX_STEPS = 6;
const MAX_OPTIONS = 12;
const STATUS = {
  LIVE_ON_GOOGLE: ["Live on Google", "emerald"],
  SENT_TO_GOOGLE: ["Sent to Google", "blue"],
  SAVED: ["Private", "rose"],
};

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900";

function posterSkin(style, accent) {
  if (style === "vibrant") return { bg: `linear-gradient(160deg, ${accent}, #111827)`, inner: "transparent", border: "none", color: "#fff" };
  if (style === "midnight") return { bg: "#0b1020", inner: "transparent", border: "none", color: "#fff" };
  if (style === "cream") return { bg: "#fbf6ea", inner: "#fff", border: `4px double ${accent}`, color: "#3b2f1e" };
  return { bg: "#fff", inner: "#fff", border: `5px solid ${accent}`, color: "#0f172a" };
}

/* ───────────────────────── small building blocks ───────────────────────── */

function Segmented({ value, onChange, items, label }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-xs font-semibold dark:bg-zinc-800">
      {items.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)} className={`rounded-md px-3 py-1.5 ${focusRing} ${value === k ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Settings row: what it is on the left, the controls on the right. */
function Section({ title, hint, action, children }) {
  return (
    <section className="grid gap-4 px-5 py-6 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-8">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-zinc-500">{hint}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Field({ label, count, max, children }) {
  return (
    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
      <span className="flex justify-between">
        {label}
        {max ? <span className={`font-normal tabular-nums ${count >= max ? "text-amber-600" : "text-zinc-400"}`}>{count}/{max}</span> : null}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

/** Scan → written → live is a real funnel, so show it as one. */
function Funnel({ scans, collected }) {
  const c = collected || {};
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}% of ${b === scans ? "scans" : "written"}` : null);
  const cells = [
    ["Scans", scans || 0, null],
    ["Reviews written", c.written || 0, pct(c.written || 0, scans)],
    ["Live on Google", c.live || 0, pct(c.live || 0, c.written)],
    ["Private feedback", c.private || 0, pct(c.private || 0, scans)],
  ];
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4">
      {cells.map(([k, n, sub], i) => (
        <div key={k} className={`px-4 py-3 ${i ? "sm:border-l" : ""} ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t sm:border-t-0" : ""} border-zinc-200 dark:border-zinc-800`}>
          <dt className="text-xs text-zinc-500">{k}</dt>
          <dd className="mt-0.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">{n}</span>
            {sub ? <span className="text-[11px] text-zinc-400">{sub}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────────────────── question editor ───────────────────────── */

function StepEditor({ step, index, onChange, onDelete }) {
  const [opt, setOpt] = useState("");
  const full = step.options.length >= MAX_OPTIONS;
  const add = () => {
    const val = opt.trim().slice(0, 40);
    if (!val || full || step.options.includes(val)) return;
    onChange({ ...step, options: [...step.options, val] });
    setOpt("");
  };
  return (
    <li className="flex gap-3 py-4">
      <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white dark:bg-white dark:text-zinc-900">{index + 2}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Input value={step.title} maxLength={120} aria-label={`Question ${index + 2}`} onChange={(e) => onChange({ ...step, title: e.target.value })} className="font-medium" />
          <button type="button" onClick={onDelete} aria-label="Delete question" className={`shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 ${focusRing}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {step.options.map((o, k) => (
            <span key={`${o}-${k}`} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-1 pl-3 pr-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {o}
              <button type="button" aria-label={`Remove ${o}`} onClick={() => onChange({ ...step, options: step.options.filter((_, j) => j !== k) })} className={`rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-rose-600 dark:hover:bg-zinc-700 ${focusRing}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {full ? (
            <span className="text-[11px] text-zinc-400">{MAX_OPTIONS} options max</span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-dashed border-zinc-300 pl-3 pr-1 focus-within:border-brand-500 dark:border-zinc-700">
              <input value={opt} maxLength={40} onChange={(e) => setOpt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Add option" aria-label="Add option" className="w-24 bg-transparent py-1 text-xs outline-none placeholder:text-zinc-400" />
              <button type="button" onClick={add} disabled={!opt.trim()} aria-label="Add" className={`rounded-full p-1 text-zinc-500 hover:text-brand-600 disabled:opacity-30 ${focusRing}`}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/* ───────────────────────── previews ───────────────────────── */

/** Poster preview in HTML (mirrors the server-rendered PNG). Sizes are in cqw so it scales with its own width. */
function PosterPreview({ p, business, qrSrc }) {
  const s = posterSkin(p.style, p.accent);
  const fs = (n) => ({ fontSize: `${n}cqw` });
  return (
    <div style={{ containerType: "inline-size" }} className="w-full">
      <div className="aspect-[1240/1754] w-full overflow-hidden rounded-lg shadow-xl ring-1 ring-black/10" style={{ background: s.bg, padding: "3%" }}>
        <div className="flex h-full flex-col items-center rounded-[3cqw] px-[6%] pt-[8%] text-center" style={{ border: s.border, background: s.inner, color: s.color }}>
          <p className="font-black tracking-wide" style={fs(5)}>
            <span className="text-[#4285F4]">G</span><span className="text-[#EA4335]">o</span><span className="text-[#FBBC05]">o</span><span className="text-[#4285F4]">g</span><span className="text-[#34A853]">l</span><span className="text-[#EA4335]">e</span>
          </p>
          <p className="mt-[1.5%] text-balance font-black uppercase leading-[1.05]" style={fs(7.4)}>{p.headline || "Rate us on Google"}</p>
          {p.subtitle ? <p className="mt-[2%] opacity-80" style={fs(3.4)}>{p.subtitle}</p> : null}
          <div className="mt-[2%] flex gap-[0.6cqw] text-amber-400">
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="fill-current" style={{ width: "4.6cqw", height: "4.6cqw" }} />)}
          </div>
          <div className="mt-[8%] flex w-full items-center justify-center gap-[5%]">
            <ol className="flex flex-col gap-[3cqw] text-left">
              {p.steps.map((t, i) => (
                <li key={i} className="flex items-center gap-[2cqw] font-semibold" style={fs(3)}>
                  <span className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: p.accent, width: "5.6cqw", height: "5.6cqw" }}>{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
            <div className="w-[40%] shrink-0 rounded-[3cqw] bg-[#0f172a] p-[2%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="Review QR code" className="aspect-square w-full rounded-[2cqw] bg-white" />
            </div>
          </div>
          <div className="flex-1" />
          {p.footer ? <p className="mb-[3%] opacity-80" style={fs(3)}>{p.footer}</p> : null}
          <div className="mb-[5%] rounded-full bg-white px-[4cqw] py-[1.5cqw] font-bold text-zinc-900 shadow" style={fs(3.4)}>{business}</div>
        </div>
      </div>
    </div>
  );
}

/** Clickable mock of what the customer sees after scanning. Built from the unsaved draft. */
function PhonePreview({ flow, business }) {
  const [rating, setRating] = useState(0);
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState({});
  const steps = flow.steps;
  const last = steps.length + 1;
  const i = Math.min(at, last);
  const happy = rating >= flow.threshold;
  const restart = () => { setRating(0); setAt(0); setPicked({}); };
  const toggle = (key) => setPicked((x) => ({ ...x, [key]: !x[key] }));
  const cta = "mt-auto w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-semibold text-white";

  let screen;
  if (flow.mode === "DIRECT") {
    screen = (
      <>
        <p className="text-sm font-semibold">{business}</p>
        <div className="mt-4 flex justify-center gap-1 text-zinc-300">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className="h-7 w-7" />)}</div>
        <div className="mt-4 h-20 rounded-lg border border-zinc-200 p-2 text-left text-[11px] text-zinc-400">Share details of your own experience at this place</div>
        <p className="mt-auto text-[11px] text-zinc-400">The Google review form opens straight away. No questions, no AI help.</p>
      </>
    );
  } else if (i === 0) {
    screen = (
      <>
        <p className="text-xs text-zinc-500">{business}</p>
        <p className="mt-6 text-base font-semibold leading-snug">How was your experience today?</p>
        <div className="mt-5 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} stars`} onClick={() => { setRating(n); setAt(1); }} className={`rounded p-0.5 text-zinc-300 hover:text-amber-400 ${focusRing}`}>
              <Star className="h-8 w-8" />
            </button>
          ))}
        </div>
        <p className="mt-auto text-[11px] text-zinc-400">Tap a rating to walk through the flow</p>
      </>
    );
  } else if (!happy) {
    screen = (
      <>
        <p className="text-amber-500">{"★".repeat(rating)}<span className="text-zinc-200">{"★".repeat(5 - rating)}</span></p>
        <p className="mt-3 text-sm font-semibold leading-snug">Sorry to hear that. Tell {business} what went wrong.</p>
        <div className="mt-3 h-24 rounded-lg border border-zinc-200 p-2 text-left text-[11px] text-zinc-400">Your message goes privately to the owner</div>
        <div className={cta}>Send privately</div>
        <p className="mt-2 text-[11px] text-zinc-500 underline">Post on Google instead</p>
      </>
    );
  } else if (i < last) {
    const st = steps[i - 1];
    screen = (
      <>
        <p className="text-sm font-semibold leading-snug">{st.title}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {st.options.map((o, k) => {
            const key = `${i}-${k}`;
            return (
              <button key={key} type="button" onClick={() => toggle(key)} className={`rounded-full border px-2.5 py-1 text-[11px] ${focusRing} ${picked[key] ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-700"}`}>
                {o}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => setAt(i + 1)} className={`${cta} ${focusRing}`}>{i === steps.length ? "Write my review" : "Next"}</button>
      </>
    );
  } else {
    screen = (
      <>
        <p className="text-sm font-semibold">Your review is ready</p>
        <div className="mt-3 space-y-1.5 rounded-lg bg-zinc-100 p-3">
          {[100, 92, 96, 60].map((w, k) => <div key={k} className="h-2 rounded bg-zinc-300" style={{ width: `${w}%` }} />)}
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">AI drafts this from the answers, in English, Hinglish or Hindi</p>
        <div className={cta}>Copy and post on Google</div>
      </>
    );
  }

  return (
    <div>
      <div className="mx-auto flex aspect-[9/17] w-[250px] max-w-full flex-col rounded-[34px] border-[7px] border-zinc-900 bg-white p-4 text-center text-zinc-900 shadow-xl dark:border-zinc-700">
        {flow.mode === "AI" ? (
          <div className="mb-5 flex gap-1" aria-hidden>
            {Array.from({ length: last + 1 }).map((_, k) => <span key={k} className={`h-1 flex-1 rounded-full ${k <= i ? "bg-zinc-900" : "bg-zinc-200"}`} />)}
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto">{screen}</div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-zinc-500">
        <span>Approximate. Shows your unsaved edits.</span>
        {flow.mode === "AI" && i > 0 ? <button type="button" onClick={restart} className={`inline-flex items-center gap-1 font-semibold text-zinc-700 hover:underline dark:text-zinc-200 ${focusRing}`}><RotateCcw className="h-3 w-3" /> Restart</button> : null}
      </div>
    </div>
  );
}

function DownloadLink({ href, disabled, children, download, ...btn }) {
  const b = <Button className="w-full justify-center" disabled={disabled} {...btn}>{children}</Button>;
  return disabled ? b : <a href={href} download={download} className="block">{b}</a>;
}

/* ───────────────────────── collected reviews ───────────────────────── */

function CollectedReviews({ items, collected }) {
  const [tab, setTab] = useState("GOOGLE");
  const list = (items || []).filter((f) => (f.kind || "PRIVATE") === tab);
  const written = collected?.written || 0;
  const live = collected?.live || 0;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Segmented label="Review type" value={tab} onChange={setTab} items={[["GOOGLE", `Written for Google (${written})`], ["PRIVATE", `Private feedback (${collected?.private || 0})`]]} />
        {tab === "GOOGLE" ? <p className="text-xs text-zinc-500">{live} of {written} confirmed live. Matched when the review syncs into the inbox.</p> : null}
      </div>
      {list.length ? (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {list.map((f) => {
            const [label, tone] = STATUS[f.status] || STATUS.SAVED;
            let picks = [];
            try { picks = JSON.parse(f.answers || "[]"); } catch { picks = []; }
            return (
              <li key={f.id} className="grid gap-x-6 gap-y-2 px-5 py-4 text-sm md:grid-cols-[200px_minmax(0,1fr)]">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">{f.name || "Customer"}</p>
                  {f.contact ? <p className="truncate text-xs text-zinc-500">{f.contact}</p> : null}
                  <p className="mt-1 text-amber-500" aria-label={`${f.rating} stars`}>{"★".repeat(f.rating)}<span className="text-zinc-200 dark:text-zinc-700">{"★".repeat(Math.max(0, 5 - f.rating))}</span></p>
                  <p className="mt-1 text-[11px] text-zinc-400">{new Date(f.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                <div className="min-w-0">
                  <p className="flex flex-wrap gap-1.5"><Badge tone={tone}>{label}</Badge>{f.lang ? <Badge>{f.lang}</Badge> : null}</p>
                  <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed text-zinc-700 dark:text-zinc-300">{f.message || <i className="text-zinc-400">Went to Google without a drafted text</i>}</p>
                  {picks.length ? <p className="mt-2 flex flex-wrap gap-1">{picks.map((p, k) => <span key={`${p}-${k}`} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">{p}</span>)}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-5 py-14 text-center">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{tab === "GOOGLE" ? "No reviews written through the QR yet" : "No private feedback yet"}</p>
          <p className="mt-1 text-xs text-zinc-500">{tab === "GOOGLE" ? "Print the poster and put it where customers pay or wait." : "Ratings below your threshold land here when a customer messages you."}</p>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── page ───────────────────────── */

export function ReviewStudio({ clientId, business }) {
  const { data, error, loading, reload } = useApi(`/api/gmb/${clientId}/review-flow`);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [v, setV] = useState(0);
  const [view, setView] = useState("setup");
  const [preview, setPreview] = useState("poster");

  const flow = draft || data?.flow;
  const pick = (f) => JSON.stringify({ m: f?.mode, s: f?.steps, p: f?.poster, t: f?.threshold });
  const dirty = Boolean(draft) && pick(draft) !== pick(data?.flow);
  const edit = (patch) => setDraft({ ...(draft || data.flow), ...patch });
  const editPoster = (patch) => edit({ poster: { ...flow.poster, ...patch } });
  const targetUrl = flow?.mode === "DIRECT" ? data?.links?.review : data?.flowUrl;
  const qrSrc = useMemo(() => `/api/gmb/${clientId}/review-qr?format=png&v=${v}`, [clientId, v]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      await apiFetch(`/api/gmb/${clientId}/review-flow`, { method: "PUT", body: { mode: flow.mode, steps: flow.steps, poster: flow.poster, threshold: flow.threshold } });
      setDraft(null);
      setV((x) => x + 1);
      await reload();
      setMsg({ tone: "green", text: "Saved. QR and poster updated." });
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMsg({ tone: "red", text: "Could not copy. Select the link and copy it manually." });
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (loading && !data) return <Skeleton className="h-[70vh]" />;

  const total = (data.collected?.written || 0) + (data.collected?.private || 0);

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/gmb/${clientId}?tab=reviews`} className={`inline-flex items-center gap-1 rounded text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white ${focusRing}`}>
            <ArrowLeft className="h-3.5 w-3.5" /> {business} reviews
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Review QR and poster</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">Happy customers get a ready-to-post review in 30 seconds. Unhappy ones can reach you privately first.</p>
        </div>
        <Segmented label="View" value={view} onChange={setView} items={[["setup", "Set up"], ["reviews", `Collected reviews (${total})`]]} />
      </header>

      <Funnel scans={data.flow.scans} collected={data.collected} />
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

      {view === "reviews" ? (
        <CollectedReviews items={data.feedback} collected={data.collected} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="divide-y divide-zinc-200 overflow-hidden dark:divide-zinc-800">
            {/* destination */}
            <Section title="Where the QR goes" hint="Changing this keeps the same printed QR working.">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["AI", "AI review assistant", "Stars, a few quick questions, then AI writes the review in their words. Low ratings can message you privately.", true],
                  ["DIRECT", "Google review form", "Opens your Google review pop-up straight away.", false],
                ].map(([m, t, d, rec]) => {
                  const on = flow.mode === m;
                  return (
                    <label key={m} className={`relative cursor-pointer rounded-xl border p-4 focus-within:ring-2 focus-within:ring-brand-500 ${on ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500 dark:bg-brand-950/20" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"}`}>
                      <input type="radio" name="mode" className="sr-only" checked={on} onChange={() => edit({ mode: m })} />
                      <span className={`absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full border ${on ? "border-brand-500 bg-brand-500 text-white" : "border-zinc-300 dark:border-zinc-600"}`}>{on ? <Check className="h-3 w-3" /> : null}</span>
                      <span className="flex flex-wrap items-center gap-2 pr-6 text-sm font-semibold text-zinc-900 dark:text-white">{t} {rec ? <Badge tone="blue">Recommended</Badge> : null}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{d}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 pl-3 dark:border-zinc-800 dark:bg-zinc-950">
                <span className={`min-w-0 flex-1 truncate text-xs ${targetUrl ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}`}>{targetUrl || "Connect Google to get the review link"}</span>
                <Button variant="secondary" className="!py-1.5 text-xs" disabled={!targetUrl} onClick={copyLink}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy link"}</Button>
                {targetUrl ? <a href={targetUrl} target="_blank" rel="noreferrer"><Button variant="secondary" className="!py-1.5 text-xs"><ExternalLink className="h-3.5 w-3.5" /> Open</Button></a> : null}
              </div>
            </Section>

            {/* questions */}
            {flow.mode === "AI" ? (
              <Section
                title="Questions"
                hint="Asked before AI writes the review. Answers become the details in it."
                action={<Button variant="ghost" className="!px-0 text-xs" onClick={() => edit({ steps: DEFAULT_STEPS })}><RotateCcw className="h-3.5 w-3.5" /> Reset to defaults</Button>}
              >
                <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  <li className="flex gap-3 pb-4">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white dark:bg-white dark:text-zinc-900">1</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white">How was your experience today? <Badge tone="amber">Always first</Badge></p>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                        <select value={flow.threshold} onChange={(e) => edit({ threshold: Number(e.target.value) })} aria-label="Rating threshold" className={`mr-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white ${focusRing}`}>
                          {[3, 4, 5].map((n) => <option key={n} value={n}>{n}★ and above</option>)}
                        </select>
                        get AI review help. Lower ratings are offered a private message to you first. The Google option always stays available.
                      </p>
                    </div>
                  </li>
                  {flow.steps.map((s, i) => (
                    <StepEditor key={s.id} step={s} index={i} onChange={(x) => edit({ steps: flow.steps.map((y, k) => (k === i ? x : y)) })} onDelete={() => edit({ steps: flow.steps.filter((_, k) => k !== i) })} />
                  ))}
                </ol>
                {flow.steps.length < MAX_STEPS ? (
                  <button type="button" onClick={() => edit({ steps: [...flow.steps, { id: `step${Date.now()}`, title: "New question", options: ["Option 1", "Option 2"] }] })} className={`mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 ${focusRing}`}>
                    <Plus className="h-4 w-4" /> Add question
                  </button>
                ) : <p className="mt-2 text-xs text-zinc-400">{MAX_STEPS} questions max. Shorter flows get more reviews.</p>}
              </Section>
            ) : null}

            {/* poster look */}
            <Section title="Poster look" hint="Style and colour of the A4 poster and standee.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STYLES.map(([k, t, d]) => {
                  const on = flow.poster.style === k;
                  const s = posterSkin(k, flow.poster.accent);
                  return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => editPoster({ style: k })} className={`rounded-xl border p-2.5 text-left ${focusRing} ${on ? "border-brand-500 ring-1 ring-brand-500" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"}`}>
                      <span className="block aspect-[5/4] rounded-md p-1.5 ring-1 ring-black/10" style={{ background: s.bg }} aria-hidden>
                        <span className="flex h-full flex-col items-center justify-center gap-1 rounded" style={{ border: s.border === "none" ? "none" : s.border.replace(/^\d+px/, "2px").replace("double", "solid"), background: s.inner }}>
                          <span className="h-1 w-8 rounded-full" style={{ background: s.color, opacity: 0.85 }} />
                          <span className="h-4 w-4 rounded-sm" style={{ background: s.color === "#fff" ? "#fff" : "#0f172a" }} />
                        </span>
                      </span>
                      <span className="mt-2 block text-xs font-semibold text-zinc-900 dark:text-white">{t}</span>
                      <span className="block text-[11px] leading-snug text-zinc-500">{d}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mb-2 mt-5 text-xs font-medium text-zinc-600 dark:text-zinc-300">Accent colour</p>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENTS.map((a) => {
                  const on = flow.poster.accent?.toLowerCase() === a.toLowerCase();
                  return (
                    <button key={a} type="button" aria-label={`Accent ${a}`} aria-pressed={on} onClick={() => editPoster({ accent: a })} className="flex h-7 w-7 items-center justify-center rounded-full outline-none ring-2 ring-offset-2 focus-visible:ring-zinc-400 dark:ring-offset-zinc-900" style={{ background: a, "--tw-ring-color": on ? a : undefined }}>
                      {on ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                    </button>
                  );
                })}
                <label className="ml-1 flex cursor-pointer items-center gap-2 rounded-full border border-zinc-200 py-1 pl-1 pr-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                  <input type="color" value={flow.poster.accent} onChange={(e) => editPoster({ accent: e.target.value })} className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Custom colour" />
                  Custom
                </label>
              </div>
            </Section>

            {/* poster text */}
            <Section title="Poster text" hint="Keep it short. It has to read from a counter away.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Headline" count={flow.poster.headline.length} max={32}>
                  <Input maxLength={32} value={flow.poster.headline} onChange={(e) => editPoster({ headline: e.target.value })} />
                </Field>
                <Field label="Subtitle" count={flow.poster.subtitle.length} max={50}>
                  <Input maxLength={50} value={flow.poster.subtitle} onChange={(e) => editPoster({ subtitle: e.target.value })} />
                </Field>
              </div>
              <p className="mb-2 mt-4 text-xs font-medium text-zinc-600 dark:text-zinc-300">Steps printed beside the QR</p>
              <div className="space-y-2">
                {flow.poster.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: flow.poster.accent }}>{i + 1}</span>
                    <Input maxLength={28} value={s} aria-label={`Poster step ${i + 1}`} onChange={(e) => editPoster({ steps: flow.poster.steps.map((x, k) => (k === i ? e.target.value : x)) })} />
                    <span className={`w-10 text-right text-[11px] tabular-nums ${s.length >= 28 ? "text-amber-600" : "text-zinc-400"}`}>{s.length}/28</span>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Field label="Footer line (optional)" count={(flow.poster.footer || "").length} max={60}>
                  <Input maxLength={60} value={flow.poster.footer || ""} onChange={(e) => editPoster({ footer: e.target.value })} placeholder="Thank you for choosing us!" />
                </Field>
              </div>
            </Section>
          </Card>

          {/* preview + downloads */}
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <Card className="p-4">
              <div className="mb-4 flex items-center justify-between gap-2">
                <Segmented label="Preview" value={preview} onChange={setPreview} items={[["poster", "Poster"], ["phone", "Customer view"]]} />
                {preview === "poster" ? <Badge>A4</Badge> : null}
              </div>
              {preview === "poster" ? <PosterPreview p={flow.poster} business={business} qrSrc={qrSrc} /> : <PhonePreview key={flow.mode} flow={flow} business={business} />}
              <div className="mt-4 grid gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <DownloadLink href={`/api/gmb/${clientId}/review-qr?poster=1&download=1&v=${v}`} disabled={dirty}><Printer className="h-4 w-4" /> Download poster (print-ready PNG)</DownloadLink>
                <div className="grid grid-cols-2 gap-2">
                  <DownloadLink variant="secondary" href={`/api/gmb/${clientId}/review-qr?format=png&download=1&v=${v}`}><Download className="h-4 w-4" /> QR only, PNG</DownloadLink>
                  <DownloadLink variant="secondary" download href={`/api/gmb/${clientId}/review-qr?format=svg&v=${v}`}><Download className="h-4 w-4" /> QR only, SVG</DownloadLink>
                </div>
                {dirty ? <p className="text-center text-[11px] text-amber-600">Save changes to download the updated poster</p> : null}
              </div>
            </Card>
          </aside>
        </div>
      )}

      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <span className="mr-auto flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200"><span className="h-2 w-2 rounded-full bg-amber-500" /> Unsaved changes</span>
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={Boolean(busy)}>Discard</Button>
            <Button onClick={save} disabled={Boolean(busy)}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}