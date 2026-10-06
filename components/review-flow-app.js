"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, MessageSquareHeart, RefreshCw, Sparkles, Star } from "lucide-react";

const FACES = ["😞", "😕", "😐", "🙂", "🤩"];
const LABELS = ["Terrible", "Poor", "Average", "Good", "Excellent"];

async function call(slug, body) {
  const r = await fetch(`/api/public/review/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j;
}

/** Mobile-first review assistant: stars -> chips -> AI drafts -> copy & open Google. */
export function ReviewFlowApp({ slug, business, category, city, logo, color, mode, steps, threshold, reviewUrl }) {
  const [rating, setRating] = useState(0);
  const [step, setStep] = useState(-1); // -1 = stars, 0..n-1 = questions, n = extra text, "ai" = drafts, "low" = feedback, "done"
  const [picks, setPicks] = useState([]);
  const [extra, setExtra] = useState("");
  const [lang, setLang] = useState("English");
  const [drafts, setDrafts] = useState(null);
  const [chosen, setChosen] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [fb, setFb] = useState({ message: "", name: "", contact: "" });
  const [final, setFinal] = useState("");
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    call(slug, { action: "scan" }).catch(() => {});
    if (mode === "DIRECT" && reviewUrl) window.location.replace(reviewUrl);
  }, [slug, mode, reviewUrl]);

  /** Saves the chosen review, copies it, then opens Google's review box (the only way Google allows). */
  const goGoogle = async (text) => {
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } catch {
        /* clipboard blocked - the text stays on screen to copy manually */
      }
    }
    call(slug, { action: "google", rating, text, picks, lang }).catch(() => {});
    setFinal(text || "");
    setStep("post");
  };
  const openGoogle = () => {
    if (reviewUrl) window.open(reviewUrl, "_blank", "noopener");
    setOpened(true);
  };
  const pickStar = (n) => {
    setRating(n);
    setStep(n >= threshold ? 0 : "low");
  };
  const toggle = (o) => setPicks((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  async function generate() {
    setBusy(true);
    setErr("");
    try {
      const r = await call(slug, { action: "suggest", rating, picks, extra, lang });
      setDrafts(r.reviews);
      setChosen(0);
      setStep("ai");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function sendFeedback() {
    setBusy(true);
    setErr("");
    try {
      await call(slug, { action: "feedback", rating, picks, ...fb });
      setStep("thanks");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const progress = typeof step === "number" && step >= 0 ? ((step + 1) / (steps.length + 3)) * 100 : step === "ai" ? 85 : step === "post" ? 95 : step === "done" ? 100 : 8;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-50 to-white text-zinc-900" style={{ "--c": color }}>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-full w-full object-cover" />
            ) : <span className="text-2xl font-black" style={{ color }}>{business.slice(0, 1)}</span>}
          </div>
          <p className="mt-3 text-lg font-bold">{business}</p>
          <p className="text-xs text-zinc-500">{[category, city].filter(Boolean).join(" · ")}</p>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: color }} /></div>
        </div>

        <div className="mt-8 flex-1">
          {step === -1 ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold">How was your experience?</h1>
              <p className="mt-1 text-sm text-zinc-500">Tap a star - it takes 30 seconds.</p>
              <div className="mt-8 grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => pickStar(n)} className="group flex flex-col items-center gap-1 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-95">
                    <span className="text-3xl transition group-hover:scale-110">{FACES[n - 1]}</span>
                    <span className="flex">{Array.from({ length: n }).map((_, i) => <Star key={i} className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />)}</span>
                    <span className="text-[10px] font-medium text-zinc-500">{LABELS[n - 1]}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {typeof step === "number" && step >= 0 && step < steps.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>Question {step + 1} of {steps.length}</p>
              <h2 className="mt-1 text-xl font-bold">{steps[step].title}</h2>
              <p className="text-sm text-zinc-500">Pick all that apply</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {steps[step].options.map((o) => {
                  const on = picks.includes(o);
                  return (
                    <button key={o} type="button" onClick={() => toggle(o)} className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium ring-1 transition ${on ? "text-white ring-transparent" : "bg-white ring-zinc-200 hover:ring-zinc-300"}`} style={on ? { background: color } : undefined}>
                      {on ? <Check className="h-3.5 w-3.5" /> : null}{o}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => setStep(step + 1)} className="mt-8 w-full rounded-2xl py-4 text-base font-bold text-white shadow-lg transition active:scale-[.98]" style={{ background: color }}>Continue</button>
              <button type="button" onClick={() => setStep(step + 1)} className="mt-2 w-full py-2 text-sm text-zinc-500">Skip</button>
            </div>
          ) : null}

          {step === steps.length ? (
            <div>
              <h2 className="text-xl font-bold">Anything else you&apos;d like to mention?</h2>
              <p className="text-sm text-zinc-500">Optional - a name, a detail, how it helped you.</p>
              <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={4} maxLength={400} className="mt-4 w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm outline-none focus:ring-2" placeholder="e.g. Dr. Sharma explained everything patiently" />
              <div className="mt-4 flex gap-2 rounded-2xl bg-zinc-100 p-1 text-sm">
                {["English", "Hinglish", "Hindi"].map((l) => <button key={l} type="button" onClick={() => setLang(l)} className={`flex-1 rounded-xl py-2 font-semibold ${lang === l ? "bg-white shadow-sm" : "text-zinc-500"}`}>{l}</button>)}
              </div>
              {err ? <p className="mt-3 text-sm text-rose-600">{err}</p> : null}
              <button type="button" onClick={generate} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg disabled:opacity-60" style={{ background: color }}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Write my review
              </button>
              <button type="button" onClick={() => { call(slug, { action: "google", rating, picks }).catch(() => {}); if (reviewUrl) window.open(reviewUrl, "_blank", "noopener"); setStep("done"); }} className="mt-2 w-full py-2 text-sm text-zinc-500">I&apos;ll write it myself on Google</button>
            </div>
          ) : null}

          {step === "ai" && drafts ? (
            <div>
              <h2 className="text-xl font-bold">Pick a review</h2>
              <p className="text-sm text-zinc-500">Edit it if you like. We copy it - just paste it on Google.</p>
              <div className="mt-4 space-y-3">
                {drafts.map((d, i) => (
                  <button key={i} type="button" onClick={() => setChosen(i)} className={`w-full rounded-2xl bg-white p-4 text-left text-sm leading-6 ring-2 transition ${chosen === i ? "" : "ring-transparent shadow-sm"}`} style={chosen === i ? { "--tw-ring-color": color } : undefined}>
                    <span className="mb-1 flex text-amber-400">{Array.from({ length: rating }).map((_, k) => <Star key={k} className="h-3.5 w-3.5 fill-current" />)}</span>
                    {d}
                  </button>
                ))}
              </div>
              <textarea value={drafts[chosen]} onChange={(e) => setDrafts(drafts.map((d, i) => (i === chosen ? e.target.value : d)))} rows={4} className="mt-3 w-full rounded-2xl border border-zinc-200 bg-white p-3 text-sm" />
              <button type="button" onClick={() => goGoogle(drafts[chosen])} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg" style={{ background: color }}>
                <Copy className="h-5 w-5" /> Save & copy my review
              </button>
              <button type="button" onClick={generate} disabled={busy} className="mt-2 flex w-full items-center justify-center gap-1.5 py-2 text-sm text-zinc-500">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Write different versions</button>
            </div>
          ) : null}

          {step === "low" ? (
            <div>
              <div className="flex justify-center text-4xl">{FACES[rating - 1]}</div>
              <h2 className="mt-3 text-center text-xl font-bold">We&apos;re sorry it wasn&apos;t great</h2>
              <p className="text-center text-sm text-zinc-500">Tell the owner directly - they read every message and will try to make it right.</p>
              <textarea value={fb.message} onChange={(e) => setFb({ ...fb, message: e.target.value })} rows={5} maxLength={2000} className="mt-5 w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm" placeholder="What went wrong?" />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input value={fb.name} onChange={(e) => setFb({ ...fb, name: e.target.value })} className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm" placeholder="Name (optional)" />
                <input value={fb.contact} onChange={(e) => setFb({ ...fb, contact: e.target.value })} className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm" placeholder="Phone / email (optional)" />
              </div>
              {err ? <p className="mt-3 text-sm text-rose-600">{err}</p> : null}
              <button type="button" onClick={sendFeedback} disabled={busy || !fb.message.trim()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg disabled:opacity-50" style={{ background: color }}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquareHeart className="h-5 w-5" />} Send to the owner
              </button>
              {reviewUrl ? <button type="button" onClick={() => { call(slug, { action: "google", rating, picks }).catch(() => {}); window.open(reviewUrl, "_blank", "noopener"); setStep("done"); }} className="mt-3 w-full py-2 text-sm text-zinc-500 underline">Post a public review on Google instead</button> : null}
            </div>
          ) : null}

          {step === "post" ? (
            <div>
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                <Check className="h-5 w-5" /> Review saved{copied ? " & copied" : ""} - one last tap
              </div>
              <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 shadow-sm ring-1 ring-zinc-200">
                <span className="mb-1 flex text-amber-400">{Array.from({ length: rating }).map((_, k) => <Star key={k} className="h-3.5 w-3.5 fill-current" />)}</span>
                {final}
              </div>
              <ol className="mt-5 space-y-3 text-sm">
                {[`Tap “Post on Google” below`, `Choose ${rating} star${rating > 1 ? "s" : ""}`, "Long-press the text box → Paste → Post"].map((t, i) => (
                  <li key={t} className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: color }}>{i + 1}</span>{t}</li>
                ))}
              </ol>
              <button type="button" onClick={openGoogle} disabled={!reviewUrl} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg disabled:opacity-50" style={{ background: color }}>
                <ExternalLink className="h-5 w-5" /> Post on Google
              </button>
              {!copied ? (
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(final); setCopied(true); } catch { /* ignore */ } }} className="mt-2 w-full py-2 text-sm font-semibold" style={{ color }}>Copy the text again</button>
              ) : null}
              {opened ? <button type="button" onClick={() => setStep("done")} className="mt-1 w-full py-2 text-sm text-zinc-500">I&apos;ve posted it ✓</button> : null}
              <p className="mt-4 text-center text-[11px] text-zinc-400">Google only accepts reviews posted from the customer&apos;s own Google account - that&apos;s why this last step happens on Google.</p>
            </div>
          ) : null}

          {step === "done" || step === "thanks" ? (
            <div className="flex flex-col items-center pt-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg" style={{ background: color }}><Check className="h-8 w-8" /></div>
              <h2 className="mt-4 text-2xl font-bold">Thank you! 🙏</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {step === "thanks" ? "Your message was sent to the owner." : "Thanks for taking the time - it really helps a local business."}
              </p>
              {step === "done" && reviewUrl ? <a href={reviewUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold">Open Google again <ExternalLink className="h-4 w-4" /></a> : null}
            </div>
          ) : null}
        </div>

        <p className="mt-8 text-center text-[11px] text-zinc-400">Reviews are posted by you on Google. Everyone can always leave a public review.</p>
      </div>
    </div>
  );
}