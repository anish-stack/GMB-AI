"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { PANEL_TOUR } from "./steps";

const TourCtx = createContext({ start: () => {} });
export const useTour = () => useContext(TourCtx);

const KEY = (uid) => `gmb_tour_done_v1:${uid || "me"}`;
const PAD = 8;

function visibleRect(selector) {
  if (!selector || typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height || r.bottom < 0 || r.top > window.innerHeight) return null;
  return { el, r };
}

export function TourProvider({ userId, children, steps = PANEL_TOUR }) {
  const pathname = usePathname();
  const [i, setI] = useState(-1);
  const [rect, setRect] = useState(null);

  const start = useCallback(() => setI(0), []);
  const stop = useCallback(() => {
    setI(-1);
    try {
      localStorage.setItem(KEY(userId), "1");
    } catch {
      /* ignore */
    }
  }, [userId]);

  // first visit to the dashboard -> start once
  useEffect(() => {
    if (pathname !== "/dashboard") return;
    let done = true;
    try {
      done = localStorage.getItem(KEY(userId)) === "1";
    } catch {
      /* ignore */
    }
    if (done) return;
    const t = setTimeout(() => setI(0), 900);
    return () => clearTimeout(t);
  }, [pathname, userId]);

  const step = i >= 0 ? steps[i] : null;

  useLayoutEffect(() => {
    if (!step) return undefined;
    const measure = () => {
      const v = visibleRect(step.target);
      if (v) v.el.scrollIntoView({ block: "nearest", inline: "nearest" });
      const again = visibleRect(step.target);
      setRect(again ? { top: again.r.top, left: again.r.left, width: again.r.width, height: again.r.height } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useEffect(() => {
    if (!step) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") stop();
      if (e.key === "ArrowRight") setI((x) => (x + 1 < steps.length ? x + 1 : x));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, steps.length, stop]);

  // card placement: right of / below the highlight, centred when there is none
  let card = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  if (rect && typeof window !== "undefined") {
    const W = 340;
    const right = rect.left + rect.width + PAD + 14;
    if (right + W < window.innerWidth) card = { top: Math.max(12, Math.min(rect.top - 4, window.innerHeight - 260)), left: right };
    else card = { top: Math.min(rect.top + rect.height + PAD + 12, window.innerHeight - 250), left: Math.max(12, Math.min(rect.left + rect.width - W, window.innerWidth - W - 12)) };
  }

  return (
    <TourCtx.Provider value={{ start }}>
      {children}
      {step ? (
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Panel tour">
          {rect ? (
            <div
              className="pointer-events-none fixed rounded-xl ring-2 ring-brand-500 transition-all duration-300"
              style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: "0 0 0 9999px rgba(9,9,11,0.62)" }}
            />
          ) : (
            <div className="fixed inset-0 bg-zinc-950/60" />
          )}
          <div className="fixed w-[340px] max-w-[calc(100vw-24px)] rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900" style={card}>
            <button type="button" onClick={stop} aria-label="Close tour" className="absolute right-3 top-3 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            <p className="pr-6 text-base font-bold text-zinc-900 dark:text-white">{step.title}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{step.body}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="flex gap-1">
                {steps.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-brand-500" : "w-1.5 bg-zinc-200 dark:bg-zinc-700"}`} />)}
              </div>
              <div className="flex gap-2">
                {i > 0 ? <button type="button" onClick={() => setI(i - 1)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">Back</button> : (
                  <button type="button" onClick={stop} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Skip</button>
                )}
                <button type="button" onClick={() => (i + 1 < steps.length ? setI(i + 1) : stop())} className="rounded-lg bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
                  {i + 1 < steps.length ? "Next" : "Finish"}
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">{i + 1} / {steps.length}</p>
          </div>
        </div>
      ) : null}
    </TourCtx.Provider>
  );
}

/** "?" button in the top bar - replays the tour. */
export function TourButton() {
  const { start } = useTour();
  return (
    <button type="button" data-tour="help" onClick={start} aria-label="Take the panel tour" title="How to use this panel"
      className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px]">?</span>
      <span className="hidden lg:inline">Tour</span>
    </button>
  );
}
