"use client";

import { Table, EmptyRow, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { ExternalLink, Star } from "lucide-react";

function connTone(s) {
  const v = String(s || "").toUpperCase();
  if (v === "CONNECTED") return "emerald";
  if (v.includes("MOCK")) return "amber";
  if (v.includes("ERROR") || v.includes("EXPIRED") || v.includes("DISCONNECTED")) return "red";
  return "slate";
}

function syncLabel(d) {
  if (!d) return <span className="text-rose-500">Never</span>;
  const days = Math.floor((Date.now() - new Date(String(d).replace(" ", "T")).getTime()) / 86400000);
  return <span className={days > 7 ? "text-amber-600" : ""}>{formatDate(d, true)}</span>;
}

export function GmbProfileList({ rows }) {
  return (
    <Table
      head={["Location", "Client / Tenant", "Category", "City", "Rating", "Connection", "Google", "Posts", "Last post", "Last sync"]}
      empty={!rows.length ? <EmptyRow colSpan={10}>No GMB profiles match these filters.</EmptyRow> : null}
    >
      {rows.map((r) => (
        <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
          <td className="max-w-xs px-4 py-2">
            <p className="flex items-center gap-1 font-medium text-zinc-800 dark:text-zinc-100">
              <span className="truncate">{r.location_name}</span>
              {r.map_url ? (
                <a href={r.map_url} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-[#F53236]"><ExternalLink className="h-3.5 w-3.5" /></a>
              ) : null}
            </p>
            <p className="truncate text-xs text-zinc-400">{[r.phone, r.address].filter(Boolean).join(" · ") || "-"}</p>
          </td>
          <td className="px-4 py-2 text-xs">
            <p className="font-medium text-zinc-700 dark:text-zinc-200">
              {r.client_name} {!r.client_active ? <Badge tone="red" className="ml-1 !py-0">inactive</Badge> : null}
            </p>
            <p className="text-zinc-400">{r.tenant_name}</p>
          </td>
          <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">{r.category || "-"}</td>
          <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">{r.city || "-"}</td>
          <td className="px-4 py-2 text-xs">
            <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-200">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {Number(r.rating || 0).toFixed(1)}
            </span>
            <span className="block text-zinc-400">{r.review_count} reviews</span>
          </td>
          <td className="px-4 py-2">
            <div className="flex flex-wrap gap-1">
              <Badge tone={connTone(r.connection_status)}>{String(r.connection_status).replaceAll("_", " ")}</Badge>
              <Badge>{r.provider}</Badge>
            </div>
          </td>
          <td className="px-4 py-2 text-xs">
            {r.google_linked ? <span className="text-emerald-600">{r.google_email || "Linked"}</span> : <span className="text-zinc-400">Not linked</span>}
          </td>
          <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-800 dark:text-zinc-100">{r.published_posts}</span> / {r.total_posts}
            <span className="block text-zinc-400">
              {r.pending_posts ? `${r.pending_posts} pending` : ""}{r.pending_posts && r.failed_posts ? " · " : ""}{r.failed_posts ? <span className="text-rose-500">{r.failed_posts} failed</span> : ""}
            </span>
          </td>
          <td className="px-4 py-2 text-xs text-zinc-500">{r.last_post_at ? formatDate(r.last_post_at) : "-"}</td>
          <td className="px-4 py-2 text-xs text-zinc-500">{syncLabel(r.last_synced_at)}</td>
        </tr>
      ))}
    </Table>
  );
}
