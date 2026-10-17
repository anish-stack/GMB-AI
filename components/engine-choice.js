"use client";

import { useCallback, useRef, useState } from "react";
import { Cpu, Zap, AlertTriangle, Layers } from "lucide-react";
import { Modal } from "@/components/ui";

/**
 * Ask which AI writes the text of a manual run.
 *   const [engineDialog, askEngine] = useEngineChoice();
 *   const engine = await askEngine();      // "hybrid" | "ollama" | "gemini" | "auto" | null (cancelled)
 *   fetch(..., { body: JSON.stringify({ ..., engine }) })
 * Only one engine available -> returns it without showing the dialog.
 */
export function useEngineChoice() {
  const [state, setState] = useState(null); // { info }
  const resolver = useRef(null);

  const ask = useCallback(async () => {
    const info = await fetch("/api/ai/engines").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const ollamaOn = Boolean(info?.ollama?.enabled);
    const geminiOn = Boolean(info?.gemini?.configured);
    if (!ollamaOn && !geminiOn) return "auto";
    if (!ollamaOn) return "gemini";
    if (!geminiOn) return "ollama";
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({ info });
    });
  }, []);

  const finish = (value) => {
    const r = resolver.current;
    resolver.current = null;
    setState(null);
    r?.(value);
  };

  const info = state?.info;
  const dialog = (
    <Modal open={Boolean(state)} title="Which AI should write this?" onClose={() => finish(null)} size="sm">
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => finish("hybrid")}
          className="flex w-full items-start gap-3 rounded-xl border-2 border-brand-300 p-3 text-left transition hover:border-brand-500 hover:bg-brand-50/50 dark:border-brand-700 dark:hover:bg-brand-950/20"
        >
          <Layers className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold">
              Hybrid <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">RECOMMENDED</span>
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Post text by Gemini (best quality), research, keywords, topic and checks by Ollama (free). Low cost.
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => finish("ollama")}
          className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-zinc-700 dark:hover:bg-emerald-950/20"
        >
          <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold">
              Ollama <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">FREE</span>
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Local {info?.ollama?.model || "model"} - no AI cost for text, slower (a few minutes per post).
            </span>
            {info && !info.ollama?.up ? (
              <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                <AlertTriangle className="h-3 w-3" /> Ollama is not reachable right now - Gemini will be used instead.
              </span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => finish("gemini")}
          className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 p-3 text-left transition hover:border-violet-400 hover:bg-violet-50/50 dark:border-zinc-700 dark:hover:bg-violet-950/20"
        >
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold">
              Gemini <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">FAST</span>
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              {info?.gemini?.model || "Gemini"} - ready in under a minute, better long posts, paid per post.
            </span>
          </span>
        </button>
        <p className="pt-1 text-center text-[11px] text-zinc-400">
          The image is always made with Gemini. Night / calendar runs use{" "}
          {info?.background === "gemini" ? "Gemini" : info?.background === "ollama" ? "Ollama" : "Hybrid"} automatically.
        </p>
      </div>
    </Modal>
  );

  return [dialog, ask];
}
