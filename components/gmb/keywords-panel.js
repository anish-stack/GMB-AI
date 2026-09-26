"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";
import { Card, Button, Select, Input, Alert, Skeleton, EmptyState, PanelHeader } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const RANGES = [
  { value: "3", label: "Last 3 months" },
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
];

function downloadCsv(rows, name) {
  const csv = ["keyword,impressions", ...rows.map((r) => `"${String(r.keyword).replaceAll('"', '""')}",${r.impressions}`)].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function KeywordsPanel({ clientId }) {
  const [range, setRange] = useState("3");
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useApi(
    `/api/gmb/${clientId}/search-keywords?startMonth=${monthsAgo(Number(range))}`,
  );

  const keywords = useMemo(() => data?.keywords || [], [data]);
  const total = useMemo(() => keywords.reduce((s, k) => s + (k.impressions || 0), 0), [keywords]);
  const max = keywords[0]?.impressions || 1;
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? keywords.filter((k) => k.keyword.toLowerCase().includes(term)) : keywords;
  }, [keywords, q]);

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={Search}
        tone="violet"
        title="Search keywords"
        subtitle="What customers typed on Google before finding this listing"
        count={keywords.length || null}
        actions={
          <>
            <Select value={range} onChange={(e) => setRange(e.target.value)} className="!w-auto" aria-label="Date range">
              {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
            <Button variant="secondary" onClick={reload} disabled={loading} aria-label="Refresh">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button variant="secondary" disabled={!keywords.length} onClick={() => downloadCsv(keywords, `search-keywords-${clientId}.csv`)}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span>
            </Button>
          </>
        }
      />
      <div className="space-y-4 p-4 sm:p-5">
        {error ? <Alert>{error}</Alert> : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-violet-50 p-3.5 dark:bg-violet-950/30">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Keywords</p>
            <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{keywords.length}</p>
          </div>
          <div className="rounded-xl bg-sky-50 p-3.5 dark:bg-sky-950/30">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Impressions</p>
            <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{total.toLocaleString("en-IN")}</p>
          </div>
        </div>

        {keywords.length > 8 ? (
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter keywords..." aria-label="Filter keywords" />
        ) : null}

        {loading && !keywords.length ? (
          <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : shown.length ? (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {shown.slice(0, 100).map((k) => (
              <li key={k.keyword} className="py-2.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-zinc-800 dark:text-zinc-200">{k.keyword}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {k.impressions.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-violet-500/70" style={{ width: `${Math.max(3, (k.impressions / max) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Search}
            title={q ? "No keyword matches" : "No keyword data yet"}
            text={data?.is_mock ? "Search keywords come from the live Google Business Profile API." : "Google shares this data monthly - try a longer range."}
          />
        )}
      </div>
    </Card>
  );
}
