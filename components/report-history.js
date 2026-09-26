"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, FileText, Mail, MessageCircle, Link2, Download } from "lucide-react";
import { Card, Input, Select, Alert, Skeleton, EmptyState, PanelHeader, Button, Badge } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";

const METHOD = { EMAIL: [Mail, "Email"], WHATSAPP: [MessageCircle, "WhatsApp"], LINK: [Link2, "Link"], DOWNLOAD: [Download, "Download"] };
const STATUS_TONE = { SENT: "emerald", GENERATED: "slate", QUEUED: "amber", FAILED: "red" };

export function ReportHistory({ clients }) {
  const [clientId, setClientId] = useState("");
  const [method, setMethod] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi(`/api/reports/shares?page=${page}&client_id=${clientId}&method=${method}&q=${encodeURIComponent(q)}`);
  const items = data?.items || [];
  const pages = Math.max(1, Math.ceil((data?.total || 0) / 25));

  return (
    <Card className="overflow-hidden">
      <PanelHeader icon={FileText} title="Shared reports" subtitle="Every PDF report generated or shared with a business owner" count={data?.total || null} />
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }} aria-label="Client">
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
          </Select>
          <Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} aria-label="Method">
            <option value="">All methods</option>
            {Object.entries(METHOD).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search business or recipient" />
        </div>
        {error ? <Alert>{error}</Alert> : null}
        {loading && !items.length ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Business</th>
                  <th className="py-2 pr-3 font-medium">Period</th>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 font-medium">Shared with</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Views</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((s) => {
                  const [Icon, label] = METHOD[s.method] || [FileText, s.method];
                  return (
                    <tr key={s.id} className="align-top">
                      <td className="py-3 pr-3 text-xs text-zinc-500">{formatDate(s.created_at, true)}<div className="text-[11px]">by {s.shared_by_name}</div></td>
                      <td className="py-3 pr-3"><Link href={`/gmb/${s.client_id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">{s.business_name}</Link></td>
                      <td className="py-3 pr-3 text-xs text-zinc-500">{String(s.period_start).slice(0, 10)} → {String(s.period_end).slice(0, 10)}</td>
                      <td className="py-3 pr-3"><span className="inline-flex items-center gap-1 text-xs"><Icon className="h-3.5 w-3.5" /> {label}</span></td>
                      <td className="py-3 pr-3 text-xs text-zinc-600 dark:text-zinc-300">{s.shared_with_name || ""}<div>{s.shared_with_email || s.shared_with_phone || "-"}</div></td>
                      <td className="py-3 pr-3"><Badge tone={STATUS_TONE[s.status] || "slate"}>{s.status}</Badge>{s.error ? <div className="mt-1 max-w-40 truncate text-[11px] text-rose-600" title={s.error}>{s.error}</div> : null}</td>
                      <td className="py-3 pr-3 text-xs text-zinc-500">
                        {s.method === "DOWNLOAD" ? "-" : <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {s.view_count}</span>}
                        {s.last_viewed_at ? <div className="text-[11px]">last {formatDate(s.last_viewed_at, true)}</div> : null}
                      </td>
                      <td className="py-3 text-right"><a href={`/api/reports/shares/${s.id}/file`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#F53236] hover:underline">Open PDF</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={FileText} title="No reports shared yet" text="Open a GMB profile and use Report → Generate & share." />
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page} of {pages}</span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
