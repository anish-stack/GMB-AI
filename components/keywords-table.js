"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Card,
  CardHeader,
  Table,
  EmptyRow,
  Badge,
  Input,
  Select,
} from "@/components/ui";
import { truncate } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50, 100];

function pageWindow(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, page - 1, page, page + 1]);
  const nums = [...set]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out = [];
  nums.forEach((p, i) => {
    if (i && p - nums[i - 1] > 1) out.push("...");
    out.push(p);
  });
  return out;
}

export function KeywordsTable({ rows, clientFiltered }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const types = [...new Set(rows.map((k) => k.kw_type).filter(Boolean))];

  const filtered = rows.filter((k) => {
    if (type && k.kw_type !== type) return false;
    if (source && k.source !== source) return false;
    if (
      q &&
      !`${k.keyword} ${k.business_name}`.toLowerCase().includes(q.toLowerCase())
    )
      return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const startIdx = (current - 1) * pageSize;
  const pageRows = filtered.slice(startIdx, startIdx + pageSize);

  const navBtn =
    "flex h-8 min-w-8 items-center justify-center rounded-md border border-zinc-200 px-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800";

  return (
    <Card>
      <CardHeader
        title={`${filtered.length} of ${rows.length} keywords`}
        subtitle={clientFiltered ? "Filtered by client" : "All clients"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search keyword..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="!w-44 !py-1.5"
            />
            <Select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="!w-32"
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
              className="!w-36"
            >
              <option value="">All sources</option>
              <option value="CLIENT">Client</option>
              <option value="AI_SUGGESTED">AI suggested</option>
            </Select>
          </div>
        }
      />
      <Table
        head={[
          "Keyword",
          "Client",
          "Type",
          "Source",
          "Relevance",
          "Priority",
          "Reason",
        ]}
        empty={
          !filtered.length ? (
            <EmptyRow colSpan={7}>No keywords match this filter.</EmptyRow>
          ) : null
        }
      >
        {pageRows.map((k) => (
          <tr key={k.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
            <td className="px-4 py-2 text-zinc-800 dark:text-zinc-100">
              {k.keyword}
            </td>
            <td className="px-4 py-2">
              <Link
                href={`/clients/${k.client_id}`}
                className="text-zinc-600 dark:text-zinc-400 hover:text-[#F53236] dark:text-brand-400"
              >
                {k.business_name}
              </Link>
            </td>
            <td className="px-4 py-2">
              <Badge>{k.kw_type}</Badge>
            </td>
            <td className="px-4 py-2">
              <Badge tone={k.source === "CLIENT" ? "emerald" : "blue"}>
                {k.source === "CLIENT" ? "Client" : "AI suggested"}
              </Badge>
            </td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
              {k.relevance_score}
            </td>
            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
              {k.priority}
            </td>
            <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              {truncate(k.reason, 80)}
            </td>
          </tr>
        ))}
      </Table>

      {filtered.length > 0 ? (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 sm:flex-row dark:border-zinc-800">
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              {startIdx + 1}-{Math.min(startIdx + pageSize, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <Select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="!w-auto !py-1"
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} / page
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className={navBtn}
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageWindow(current, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="px-1 text-xs text-zinc-400">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === current ? "page" : undefined}
                  className={`${navBtn} ${p === current ? "!border-[#F53236] !bg-[#F53236] !text-white hover:!bg-[#e81d22]" : ""}`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              className={navBtn}
              disabled={current === totalPages}
              onClick={() => setPage(current + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
