"use client";

import { useEffect } from "react";

/**
 * Disables the browser context menu inside the client panel (not in inputs).
 * UI deterrent only - NOT a security control.
 */
export function NoContextMenu({ enabled = true }) {
  useEffect(() => {
    if (!enabled) return undefined;
    const block = (e) => {
      const t = e.target;
      if (t?.closest?.("input, textarea, [contenteditable='true'], [data-allow-context]")) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, [enabled]);
  return null;
}
