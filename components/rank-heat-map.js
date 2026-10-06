"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { Flame, Grid3X3, Users } from "lucide-react";

/**
 * "Map your local search customers" - live OpenStreetMap with the rank grid on top.
 *  · Grid view: one circle per search point, coloured + labelled by the rank there
 *  · Heat view: soft overlapping glow = where customers searching this keyword FIND you
 * Colours: #1-3 green · #4-10 orange · #11-20 pink · 20+/not found dark red.
 */
export const rankColor = (r) => (r == null || r > 20 ? "#7f1d1d" : r <= 3 ? "#16a34a" : r <= 10 ? "#f97316" : "#ec4899");
const visibility = (r) => (r == null || r > 20 ? 0.05 : r <= 3 ? 1 : r <= 10 ? 0.6 : 0.3);

export function RankHeatMap({ scan, height = 560 }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [mode, setMode] = useState("grid");
  const [ready, setReady] = useState(false);
  const points = useMemo(() => scan.results || [], [scan.results]);

  // create the map once
  useEffect(() => {
    let alive = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!alive || !el.current || mapRef.current) return;
      const map = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
      const pts = points.filter((p) => Number.isFinite(Number(p.lat)));
      if (pts.length) map.fitBounds(L.latLngBounds(pts.map((p) => [Number(p.lat), Number(p.lng)])).pad(0.18));
      else map.setView([scan.center_lat, scan.center_lng], 13);
      L.marker([scan.center_lat, scan.center_lng], {
        icon: L.divIcon({ className: "", html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;background:#111827;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.35)"></div>`, iconSize: [34, 34], iconAnchor: [17, 34] }),
        zIndexOffset: 1000,
      }).addTo(map).bindTooltip(`<b>${String(scan.business_name || "Your business").replace(/</g, "&lt;")}</b>`, { direction: "top", offset: [0, -30] });
      mapRef.current = { map, L };
      setReady(true);
    })();
    return () => {
      alive = false;
      if (mapRef.current) {
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.id]);

  // draw grid / heat layer
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const { map, L } = mapRef.current;
    if (layerRef.current) layerRef.current.remove();
    const group = L.layerGroup();
    const radius = (Number(scan.spacing_km) || 1) * 1000;
    for (const p of points) {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!Number.isFinite(lat)) continue;
      const r = p.rank == null ? null : Number(p.rank);
      if (mode === "heat") {
        const v = visibility(r);
        // three soft rings per point blend into a heat surface
        [1.25, 0.85, 0.45].forEach((k, i) => L.circle([lat, lng], { radius: radius * k * 0.75, stroke: false, fillColor: v > 0.5 ? "#16a34a" : v > 0.25 ? "#f97316" : v > 0.1 ? "#ec4899" : "#7f1d1d", fillOpacity: (0.08 + 0.1 * i) * (0.4 + v) }).addTo(group));
      } else {
        L.circle([lat, lng], { radius: radius * 0.46, color: rankColor(r), weight: 2, dashArray: "6 6", fillColor: rankColor(r), fillOpacity: 0.18 }).addTo(group);
        L.marker([lat, lng], {
          icon: L.divIcon({ className: "", html: `<div style="width:38px;height:38px;border-radius:50%;background:${rankColor(r)};color:#fff;font:700 12px system-ui;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)">${r == null || r > 20 ? "20+" : r}</div>`, iconSize: [38, 38], iconAnchor: [19, 19] }),
        }).addTo(group).bindTooltip(r == null ? "Not in the top 20 here" : `Rank #${r} at this point`, { direction: "top", offset: [0, -16] });
      }
    }
    group.addTo(map);
    layerRef.current = group;
  }, [ready, mode, points, scan.spacing_km]);

  const counts = { top: 0, mid: 0, low: 0, none: 0 };
  for (const p of points) {
    const r = p.rank == null ? null : Number(p.rank);
    if (r == null || r > 20) counts.none++;
    else if (r <= 3) counts.top++;
    else if (r <= 10) counts.mid++;
    else counts.low++;
  }
  const reach = points.length ? Math.round(((counts.top + counts.mid * 0.6 + counts.low * 0.3) / points.length) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white"><Users className="h-4 w-4 text-brand-500" /> Map your local search customers</p>
          <p className="text-xs text-zinc-500">Where people searching &ldquo;{scan.keyword}&rdquo; find {scan.business_name} on Google Maps · customer reach <b className="text-zinc-800 dark:text-zinc-100">{reach}%</b></p>
        </div>
        <div className="flex rounded-xl bg-zinc-100 p-1 text-xs font-semibold dark:bg-zinc-800">
          <button type="button" onClick={() => setMode("grid")} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 ${mode === "grid" ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500"}`}><Grid3X3 className="h-3.5 w-3.5" /> Rank grid</button>
          <button type="button" onClick={() => setMode("heat")} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 ${mode === "heat" ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500"}`}><Flame className="h-3.5 w-3.5" /> Heat map</button>
        </div>
      </div>
      <div className="relative">
        <div ref={el} style={{ height }} className="z-0 w-full bg-zinc-100 dark:bg-zinc-900" />
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-white/95 px-3 py-2 text-[11px] font-semibold text-zinc-700 shadow-lg">
          {[["#16a34a", `#1-3 (Top 3) · ${counts.top}`], ["#f97316", `#4-10 · ${counts.mid}`], ["#ec4899", `#11-20 · ${counts.low}`], ["#7f1d1d", `20+ · ${counts.none}`]].map(([c, t]) => (
            <span key={t} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{t}</span>
          ))}
        </div>
        {scan.is_sample ? <span className="absolute right-3 top-3 z-[400] rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Sample data</span> : null}
      </div>
    </div>
  );
}
