"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardBody, Button, Select, Table, EmptyRow, Stat } from "@/components/ui";

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const RANGES = {
  "3": { label: "Last 3 Months", startMonth: monthsAgo(3) },
  "6": { label: "Last 6 Months", startMonth: monthsAgo(6) },
};

export function GmbSearchKeywordsPanel({ clientId }) {
  const [range, setRange] = useState("3");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const startMonth = RANGES[range]?.startMonth || RANGES["3"].startMonth;
      const res = await fetch(
        `/api/gmb/${clientId}/search-keywords?startMonth=${startMonth}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load keywords.");
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const keywords = data?.keywords || [];
  const totalImpressions = keywords.reduce((s, k) => s + (k.impressions || 0), 0);

  return (
    <Card>
      <CardHeader
        title="Search Keywords"
        subtitle="Terms customers used to discover this business on Google"
        action={
          <div className="flex items-center gap-2">
            <Select value={range} onChange={(e) => setRange(e.target.value)} className="!w-auto">
              <option value="3">Last 3 Months</option>
              <option value="6">Last 6 Months</option>
            </Select>
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        }
      />
      <CardBody>
        {error ? (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Stat label="Top Search Keywords" value={keywords.length} icon={Search} tone="indigo" />
          <Stat label="Total Search Impressions" value={totalImpressions.toLocaleString()} tone="blue" />
        </div>

        <Table head={["Keyword", "Impressions"]}
          empty={!loading && !keywords.length ? <EmptyRow colSpan={2}>No search keyword data for this range.</EmptyRow> : null}
        >
          {keywords.map((k) => (
            <tr key={k.keyword}>
              <td className="px-4 py-2.5 text-zinc-800 dark:text-zinc-200">{k.keyword}</td>
              <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{k.impressions}</td>
            </tr>
          ))}
        </Table>
      </CardBody>
    </Card>
  );
}
