"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const WIDTH = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl", full: "sm:max-w-6xl" };

/**
 * Rendered into <body> through a portal - a transformed / animated ancestor
 * (e.g. the page fade-in) can no longer push modals off-centre or clip them.
 * Height is capped to the viewport; only the body scrolls. Esc closes.
 * Mobile: bottom sheet. Desktop: centred card.
 */
export function ModalPortal({ open, title, onClose, children, footer, size = "md" }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-zinc-950/55 backdrop-blur-[2px] animate-[fade-in_.15s_ease]" onClick={onClose} />
      <div className={`relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10 sm:max-h-[min(86dvh,860px)] sm:rounded-2xl ${WIDTH[size] || WIDTH.md}`}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <h3 className="min-w-0 truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/70 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
