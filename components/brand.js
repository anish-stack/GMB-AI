"use client";

import { createContext, useContext } from "react";
import { Sparkles } from "lucide-react";

/** Product brand ("HBS Suite" or the agency's white-label name + logo). */
const Ctx = createContext({ name: "HBS Suite", logo: null, whiteLabel: false });
export const useBrand = () => useContext(Ctx);

export function BrandProvider({ value, children }) {
  return <Ctx.Provider value={{ name: "HBS Suite", logo: null, whiteLabel: false, ...(value || {}) }}>{children}</Ctx.Provider>;
}

/** Logo (or the sparkle mark) + name. size: sm | md | lg */
export function BrandMark({ size = "md", textClass = "text-zinc-900 dark:text-zinc-100", showName = true, sub = null }) {
  const b = useBrand();
  const box = size === "lg" ? "h-10 w-10 rounded-2xl" : size === "sm" ? "h-8 w-8 rounded-xl" : "h-9 w-9 rounded-xl";
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {b.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logo} alt={b.name} className={`${box} shrink-0 bg-white object-contain p-0.5 shadow-sm ring-1 ring-black/5`} />
      ) : (
        <span className={`flex ${box} shrink-0 items-center justify-center bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/30`}>
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </span>
      )}
      {showName ? (
        <span className="min-w-0">
          <span className={`block max-w-40 truncate font-semibold ${size === "lg" ? "text-lg" : "text-sm"} ${textClass}`}>{b.name}</span>
          {sub ? <span className="block max-w-40 truncate text-[11px] text-zinc-400">{sub}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
