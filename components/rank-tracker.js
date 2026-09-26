"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crosshair, Loader2, MapPin, Radar, Search } from "lucide-react";
import { Card, Button, Field, Input, Select, Alert, Skeleton, EmptyState, PanelHeader, Badge, Modal } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";
import { mapZoom, project, rankColor } from "@/lib/rank/geo";

function Locate({ clientId, onDone }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data, error, loading } = useApi(clientId ? `/api/rank/locate?client_id=${clientId}&q=${encodeURIComponent(search)}` : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(c) {
    setBusy(true);
    try {
      await apiFetch("/api/rank/locate", { body: { client_id: clientId, place_id: c.place_id, lat: c.lat, lng: c.lng } });
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (data?.sample) return <Alert tone="amber">Google Places API is not configured - scans will use sample data. Add the key in Admin → Integrations → Google Places.</Alert>;
  return (
    <div className="space-y-3">
      {data?.current ? <Alert tone="green">Linked to Google place <code className="text-xs">{data.current.place_id}</code>. Pick another below to change.</Alert> : null}
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Business name + area (optional)" />
        <Button variant="secondary" onClick={() => setSearch(q)}><Search className="h-4 w-4" /></Button>
      </div>
      {error || err ? <Alert>{error || err}</Alert> : null}
      {loading ? <Skeleton className="h-24" /> : (
        <ul className="space-y-2">
          {(data?.candidates || []).map((c) => (
            <li key={c.place_id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{c.name}</p><p className="truncate text-xs text-zinc-500">{c.address} · {c.rating ?? "-"}★ ({c.reviews})</p></div>
              <Button className="!py-1.5 text-xs" disabled={busy} onClick={() => pick(c)}>This is it</Button>
            </li>
          ))}
          {data && !data.candidates?.length ? <p className="text-xs text-zinc-500">No matches - refine the search.</p> : null}
        </ul>
      )}
    </div>
  );
}

export function RankTracker({ clients }) {
  const router = useRouter();
  const { data, error, loading, reload } = useApi("/api/rank/scans");
  const [form, setForm] = useState({ client_id: clients[0]?.id || "", keyword: "", grid_size: 5, spacing_km: 1 });
  const [locate, setLocate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const client = clients.find((c) => String(c.id) === String(form.client_id));
  async function start() {
    setBusy(true);
    setMsg("");
    try {
      const r = await apiFetch("/api/rank/scans", { body: form });
      // router.push(`/rank-tracker/${r.id}`);
    } catch (e) {
      setMsg(e.message);
      if (e.status === 409) setLocate(true);
    } finally {
      setBusy(false);
    }
  }
  const points = form.grid_size * form.grid_size;
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <PanelHeader icon={Radar} tone="violet" title="Local rank grid" subtitle="Where does the business rank on Google Maps across the area for a keyword?" />
        <div className="grid gap-3 p-4 sm:grid-cols-[1.2fr_1.5fr_110px_130px_auto] sm:items-end sm:p-5">
          <Field label="Client">
            <Select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>{clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}</Select>
          </Field>
          <Field label="Keyword"><Input value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="e.g. dentist near me" maxLength={160} /></Field>
          <Field label="Grid"><Select value={form.grid_size} onChange={(e) => setForm({ ...form, grid_size: Number(e.target.value) })}>{[3, 5, 7].map((n) => <option key={n} value={n}>{n}×{n}</option>)}</Select></Field>
          <Field label="Spacing"><Select value={form.spacing_km} onChange={(e) => setForm({ ...form, spacing_km: Number(e.target.value) })}>{[0.5, 1, 2, 3, 5].map((n) => <option key={n} value={n}>{n} km</option>)}</Select></Field>
          <Button onClick={start} disabled={busy || form.keyword.trim().length < 2}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} Scan</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500 dark:border-zinc-800">
          <span>{points} search points · covers {((form.grid_size - 1) * form.spacing_km).toFixed(1)} km across {client?.place_id ? "" : " · listing not linked yet"}</span>
          <button type="button" className="inline-flex items-center gap-1 font-semibold text-[#F53236]" onClick={() => setLocate(true)}><MapPin className="h-3.5 w-3.5" /> {client?.place_id ? "Change linked listing" : "Link Google listing"}</button>
        </div>
        {msg ? <div className="px-5 pb-4"><Alert>{msg}</Alert></div> : null}
      </Card>
      {error ? <Alert>{error}</Alert> : null}
      <Card className="overflow-x-auto">
        {loading && !data ? <Skeleton className="m-4 h-32" /> : data?.items?.length ? (
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-zinc-100 text-left text-xs text-zinc-500 dark:border-zinc-800"><th className="px-4 py-2">Scan</th><th>Client</th><th>Grid</th><th>Avg rank</th><th>Top 3</th><th>Found</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.items.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => router.push(`/rank-tracker/${s.id}`)}>
                  <td className="px-4 py-2.5"><p className="font-medium">&ldquo;{s.keyword}&rdquo;</p><p className="text-xs text-zinc-400">{formatDate(s.created_at, true)}</p></td>
                  <td className="text-xs">{s.business_name}</td>
                  <td className="text-xs">{s.grid_size}×{s.grid_size} · {Number(s.spacing_km)} km</td>
                  <td className="font-semibold">{s.avg_rank ?? "-"}</td>
                  <td className="text-xs">{s.top3_pct == null ? "-" : `${s.top3_pct}%`}</td>
                  <td className="text-xs">{s.found_pct == null ? "-" : `${s.found_pct}%`}</td>
                  <td><Badge tone={s.status === "DONE" ? "emerald" : s.status === "FAILED" ? "red" : "amber"}>{s.status}</Badge>{s.is_sample ? <Badge className="ml-1">sample</Badge> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Radar} title="No scans yet" text="Run your first scan above." />}
      </Card>
      <Modal open={locate} onClose={() => setLocate(false)} title={`Link Google listing - ${client?.business_name || ""}`} size="lg">
        {locate ? <Locate clientId={form.client_id} onDone={() => { setLocate(false); router.refresh(); reload(); setMsg(""); }} /> : null}
      </Modal>
    </div>
  );
}

function Heatmap({ scan }) {
  const [mapOk, setMapOk] = useState(!scan.is_sample);
  const span = (scan.grid_size - 1) * scan.spacing_km + scan.spacing_km;
  const z = mapZoom(scan.center_lat, span);
  const half = (scan.grid_size - 1) / 2;
  const pos = (p) => (mapOk ? project(p.lat, p.lng, scan.center_lat, scan.center_lng, z) : { x: 320 + (p.col - half) * (560 / scan.grid_size), y: 320 + (p.row - half) * (560 / scan.grid_size) });
  const r = Math.max(14, Math.min(30, 220 / scan.grid_size));
  return (
    <svg viewBox="0 0 640 640" className="w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900" role="img" aria-label="Rank heatmap">
      {mapOk ? <image href={`/api/rank/scans/${scan.id}/map`} x="0" y="0" width="640" height="640" onError={() => setMapOk(false)} /> : null}
      {scan.results.map((p) => {
        const { x, y } = pos(p);
        const center = p.row === half && p.col === half;
        return (
          <g key={`${p.row}-${p.col}`}>
            <title>{`${p.rank ? `#${p.rank}` : "Not in top 20"}${p.top?.length ? ` · top: ${p.top.map((t) => t.name).join(", ")}` : ""}`}</title>
            <circle cx={x} cy={y} r={r} fill={rankColor(p.rank)} fillOpacity="0.9" stroke={center ? "#111" : "#fff"} strokeWidth={center ? 3 : 2} />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={r * 0.75} fontWeight="700" fill="#fff">{p.rank || "20+"}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function RankScanView({ id }) {
  const { data, error, reload } = useApi(`/api/rank/scans/${id}`);
  const s = data?.scan;
  const running = s && (s.status === "QUEUED" || s.status === "RUNNING");
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [running, reload]);
  if (error) return <Alert>{error}</Alert>;
  if (!s) return <Skeleton className="h-96" />;
  if (running) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#F53236]" />
        <p className="font-semibold">Scanning &ldquo;{s.keyword}&rdquo; for {s.business_name}…</p>
        <p className="text-sm text-zinc-500">{s.points_done}/{s.grid_size * s.grid_size} points. You&apos;ll get a notification when it&apos;s done.</p>
      </Card>
    );
  }
  if (s.status === "FAILED") return <Alert>Scan failed: {s.error}</Alert>;
  const d = (cur, prev, lowerBetter) => {
    if (prev == null || cur == null) return null;
    const diff = +(cur - prev).toFixed(1);
    if (!diff) return <span className="text-xs text-zinc-400">no change</span>;
    const good = lowerBetter ? diff < 0 : diff > 0;
    return <span className={`text-xs font-semibold ${good ? "text-emerald-600" : "text-rose-600"}`}>{diff > 0 ? "+" : ""}{diff}{lowerBetter ? "" : "%"} vs last scan</span>;
  };
  return (
    <div className="space-y-4">
      <Link href="/rank-tracker" className="text-xs font-semibold text-zinc-500">← All scans</Link>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">&ldquo;{s.keyword}&rdquo; · {s.business_name}</h1>
          <p className="text-xs text-zinc-500">{s.grid_size}×{s.grid_size} grid · {s.spacing_km} km spacing · {formatDate(s.created_at, true)} {s.is_sample ? "· SAMPLE DATA (Places API not configured)" : ""}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-xs text-zinc-500">Average rank</p><p className="text-2xl font-bold">{s.avg_rank}</p>{d(s.avg_rank, s.previous?.avg_rank, true)}</Card>
        <Card className="p-4"><p className="text-xs text-zinc-500">In top 3</p><p className="text-2xl font-bold">{s.top3_pct}%</p>{d(s.top3_pct, s.previous?.top3_pct, false)}</Card>
        <Card className="p-4"><p className="text-xs text-zinc-500">Found in top 20</p><p className="text-2xl font-bold">{s.found_pct}%</p>{d(s.found_pct, s.previous?.found_pct, false)}</Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,640px)_1fr]">
        <Card className="p-3">
          <Heatmap scan={s} />
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
            {[["1-3", 1], ["4-7", 5], ["8-10", 9], ["11-20", 15], ["20+", null]].map(([l, v]) => <span key={l} className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: rankColor(v) }} /> {l}</span>)}
            <span>· black ring = business location</span>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold dark:border-zinc-800">Top competitors in this area</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-zinc-500"><th className="px-4 py-2">Business</th><th>Rating</th><th>Seen</th><th>Avg rank</th></tr></thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {s.competitors.map((c) => (
                <tr key={c.place_id}>
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="text-xs">{c.rating ?? "-"}★ <span className="text-zinc-400">({c.reviews})</span></td>
                  <td className="text-xs">{Math.round((c.appearances / s.results.length) * 100)}%</td>
                  <td className="text-xs">{c.avg_rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
