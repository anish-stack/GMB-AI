"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Workspace colour: the whole panel's accent (Tailwind brand-50 … brand-900 CSS
 * variables) is generated from ONE hex picked in Settings → Appearance.
 */
const Ctx = createContext({ color: null, setPreview: () => {} });
export const useThemeColor = () => useContext(Ctx);

export const DEFAULT_COLOR = "#F03138";
export const PRESETS = ["#F03138", "#2563EB", "#7C3AED", "#059669", "#EA580C", "#DB2777", "#0891B2", "#4F46E5", "#CA8A04", "#18181B"];

const STEPS = { 50: 0.92, 100: 0.84, 200: 0.68, 300: 0.48, 400: 0.24, 500: 0, 600: -0.12, 700: -0.28, 800: -0.44, 900: -0.58 };

function hexToRgb(h) {
  const m = String(h || "").replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

/** brand-50 … brand-900 from one colour (mix towards white / black). */
export function palette(hex) {
  const rgb = hexToRgb(hex) || hexToRgb(DEFAULT_COLOR);
  return Object.fromEntries(
    Object.entries(STEPS).map(([k, t]) => [k, toHex(rgb.map((c) => (t >= 0 ? c + (255 - c) * t : c * (1 + t))))]),
  );
}

export function applyPalette(hex) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!hex) {
    for (const k of Object.keys(STEPS)) root.style.removeProperty(`--color-brand-${k}`);
    return;
  }
  for (const [k, v] of Object.entries(palette(hex))) root.style.setProperty(`--color-brand-${k}`, v);
}

export function ThemeColorProvider({ color, children }) {
  const [preview, setPreviewState] = useState(null);
  const active = preview || color || null;
  useEffect(() => {
    applyPalette(active);
  }, [active]);
  const setPreview = useCallback((c) => setPreviewState(c), []);
  return <Ctx.Provider value={{ color: active || DEFAULT_COLOR, saved: color || DEFAULT_COLOR, setPreview }}>{children}</Ctx.Provider>;
}
