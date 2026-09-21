"use client";

import { useState } from "react";

/** Simple animated bar chart, no dependencies. data: [{ label, value, sub? }] */
export function BarTrend({ data, height = 160, colorClass = "fill-brand-500" }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;

  return (
    <div className="relative">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const barH = (d.value / max) * (height - 24);
          const x = i * w + w * 0.18;
          const barW = w * 0.64;
          const y = height - 20 - barH;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect
                x={x} y={y} width={barW} height={Math.max(barH, 1.5)} rx={2}
                className={hover === i ? "fill-[#F53236] transition-all" : `${colorClass} transition-all opacity-80`}
              />
              <rect x={x} y={0} width={barW} height={height} fill="transparent" />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex text-[10px] text-zinc-400">
        {data.map((d, i) => (
          <div key={i} style={{ width: `${w}%` }} className="truncate text-center">{d.label}</div>
        ))}
      </div>
      {hover !== null ? (
        <div
          className="pointer-events-none absolute -top-1 rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
          style={{ left: `${hover * w + w / 2}%`, transform: "translate(-50%, -100%)" }}
        >
          {data[hover].label}: {data[hover].value}
        </div>
      ) : null}
    </div>
  );
}

/** Horizontal stacked/segmented status distribution bar. items: [{ label, value, colorClass }] */
export function DistributionBar({ items }) {
  const total = Math.max(1, items.reduce((s, i) => s + i.value, 0));
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {items.map((it, i) => (
          <div
            key={i}
            className={`${it.colorClass} h-full transition-all`}
            style={{ width: `${(it.value / total) * 100}%` }}
            title={`${it.label}: ${it.value}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className={`h-2 w-2 rounded-full ${it.colorClass}`} />
            {it.label} <span className="font-medium text-zinc-700 dark:text-zinc-300">{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
