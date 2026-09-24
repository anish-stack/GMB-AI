"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ImageOff, Pencil, Send, Trash2, Check, X, RefreshCw } from "lucide-react";
import { Table, EmptyRow, Badge, Button, Select } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, truncate } from "@/lib/utils";
import { TASK_STATUS } from "@/lib/constants";
import { adminPostAction } from "@/components/admin/admin-post-actions";

function qaTone(score) {
  if (score == null) return "slate";
  return score >= 80 ? "emerald" : "amber";
}
function hasImage(url) {
  return url && !String(url).startsWith("data:");
}
function list(v) {
  if (!v) return [];
  try {
    const j = JSON.parse(v);
    if (Array.isArray(j)) return j.map((x) => (typeof x === "string" ? x : x?.keyword || x?.tag || JSON.stringify(x)));
  } catch {}
  return String(v).split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}
const canPublish = (r) => ["APPROVED", "READY_FOR_REVIEW"].includes(r.status);

export function GmbPostList({ rows }) {
  const router = useRouter();
  const [open, setOpen] = useState(null);
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [bulkStatus, setBulkStatus] = useState("");

  const allIds = rows.map((r) => r.id);
  const allChecked = sel.length > 0 && allIds.every((id) => sel.includes(id));
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function run(action, ids, extra = {}, label = action) {
    if (!ids.length) return;
    if (action === "delete" && !window.confirm(`Permanently delete ${ids.length} post(s)? Live posts are removed from GMB and images deleted. Cannot be undone.`)) return;
    if (action === "delete_post" && !window.confirm(`Remove ${ids.length} live post(s) from GMB?`)) return;
    if (action === "reject") {
      const reason = window.prompt("Reject reason (optional)", "");
      if (reason === null) return;
      extra = { ...extra, reason };
    }
    setBusy(`${label}:${ids.join(",")}`);
    setMsg(null);
    try {
      const data = await adminPostAction(action, ids, extra);
      const firstErr = data.results.find((r) => !r.ok)?.error;
      setMsg({
        tone: data.failed ? "err" : "ok",
        text: `${label.replaceAll("_", " ")}: ${data.succeeded} done${data.failed ? `, ${data.failed} failed (${firstErr})` : ""}`,
      });
      setSel([]);
      router.refresh();
    } catch (err) {
      setMsg({ tone: "err", text: err.message });
    } finally {
      setBusy("");
    }
  }
  const isBusy = (label, id) => busy === `${label}:${id}`;

  return (
    <div>
      {sel.length || msg ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="text-xs">
            {sel.length ? <b className="text-zinc-800 dark:text-zinc-100">{sel.length} selected</b> : null}
            {msg ? <span className={`ml-2 ${msg.tone === "ok" ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</span> : null}
          </div>
          {sel.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="secondary" className="!py-1 text-xs" disabled={!!busy} onClick={() => run("approve", sel)}><Check className="h-3.5 w-3.5" /> Approve</Button>
              <Button variant="secondary" className="!py-1 text-xs" disabled={!!busy} onClick={() => run("reject", sel)}><X className="h-3.5 w-3.5" /> Reject</Button>
              <Button variant="success" className="!py-1 text-xs" disabled={!!busy} onClick={() => run("publish", sel)}><Send className="h-3.5 w-3.5" /> Publish</Button>
              <Button variant="secondary" className="!py-1 text-xs" disabled={!!busy} onClick={() => run("regenerate", sel)}><RefreshCw className="h-3.5 w-3.5" /> Regenerate</Button>
              <Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="!w-40 !py-1 !text-xs">
                <option value="">Set status...</option>
                {Object.keys(TASK_STATUS).map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
              </Select>
              <Button variant="secondary" className="!py-1 text-xs" disabled={!!busy || !bulkStatus} onClick={() => run("set_status", sel, { status: bulkStatus })}>Apply</Button>
              <Button variant="dangerGhost" className="!py-1 text-xs" disabled={!!busy} onClick={() => run("delete_post", sel, {}, "remove_live")}>Remove live</Button>
              <Button variant="danger" className="!py-1 text-xs" disabled={!!busy} onClick={() => run("delete", sel)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
              <Button variant="ghost" className="!py-1 text-xs" onClick={() => setSel([])}>Clear</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Table
        head={[
          <input key="all" type="checkbox" className="h-4 w-4 accent-[#F53236]" checked={allChecked} onChange={() => setSel(allChecked ? [] : allIds)} aria-label="Select all" />,
          "", "Post", "Client / Tenant", "Type", "Status", "QA", "Scheduled", "Published", "Assignee", "Credits", "",
        ]}
        empty={!rows.length ? <EmptyRow colSpan={12}>No GMB posts match these filters.</EmptyRow> : null}
      >
        {rows.map((r) => {
          const isOpen = open === r.id;
          return (
            <Fragment key={r.id}>
              <tr className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${sel.includes(r.id) ? "bg-rose-50/40 dark:bg-rose-950/20" : ""}`}>
                <td className="px-4 py-2">
                  <input type="checkbox" className="h-4 w-4 accent-[#F53236]" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`Select #${r.id}`} />
                </td>
                <td className="cursor-pointer px-1 py-2 text-zinc-400" onClick={() => setOpen(isOpen ? null : r.id)}>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </td>
                <td className="max-w-xs cursor-pointer px-4 py-2" onClick={() => setOpen(isOpen ? null : r.id)}>
                  <div className="flex items-center gap-2.5">
                    {hasImage(r.image_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-zinc-200" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                        <ImageOff className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-800 dark:text-zinc-100">{r.title || r.topic || "(untitled)"}</p>
                      <p className="truncate text-xs text-zinc-400">#{r.id}{r.primary_keyword ? ` · ${r.primary_keyword}` : ""}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-xs">
                  <p className="font-medium text-zinc-700 dark:text-zinc-200">{r.client_name}</p>
                  <p className="text-zinc-400">{r.tenant_name}{r.client_city ? ` · ${r.client_city}` : ""}</p>
                </td>
                <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">{r.post_type || "-"}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge status={r.status} />
                    {r.post_id ? <Badge tone={r.is_mock ? "amber" : "blue"}>{r.is_mock ? "Mock" : "Live"}</Badge> : null}
                    {r.duplicate_of ? <Badge tone="red">Dup</Badge> : null}
                  </div>
                </td>
                <td className="px-4 py-2">{r.qa_score != null ? <Badge tone={qaTone(r.qa_score)}>{r.qa_score}</Badge> : <span className="text-xs text-zinc-400">-</span>}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">{r.scheduled_date ? formatDate(r.scheduled_date) : "-"}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">{r.published_at ? formatDate(r.published_at, true) : "-"}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">{r.employee_name || "-"}</td>
                <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">{r.credits_used}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Link href={`/admin/gmb-posts/${r.id}`} title="Open / edit" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800">
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    {canPublish(r) ? (
                      <button title="Publish" disabled={!!busy} onClick={() => run("publish", [r.id])} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
                        {isBusy("publish", r.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      </button>
                    ) : null}
                    <button title="Delete permanently" disabled={!!busy} onClick={() => run("delete", [r.id])} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                      {isBusy("delete", r.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>

              {isOpen ? (
                <tr className="bg-zinc-50/70 dark:bg-zinc-800/30">
                  <td colSpan={2} />
                  <td colSpan={10} className="px-4 py-4">
                    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                      {hasImage(r.image_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image_url} alt="" className="w-full rounded-xl object-cover ring-1 ring-zinc-200" />
                      ) : (
                        <div className="flex aspect-square items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">No image</div>
                      )}
                      <div className="space-y-3 text-sm">
                        {r.topic ? <p className="text-xs text-zinc-500"><b className="text-zinc-700 dark:text-zinc-300">Topic:</b> {r.topic}</p> : null}
                        <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-200">{r.description || "No description yet."}</p>
                        {r.cta ? <p className="text-xs"><b>CTA:</b> {r.cta}</p> : null}
                        <div className="flex flex-wrap gap-1">
                          {r.primary_keyword ? <Badge tone="indigo">{r.primary_keyword}</Badge> : null}
                          {list(r.secondary_keywords).slice(0, 10).map((k, i) => <Badge key={`k${i}`}>{truncate(k, 40)}</Badge>)}
                        </div>
                        {list(r.hashtags).length ? (
                          <p className="text-xs text-sky-600">{list(r.hashtags).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>
                        ) : null}
                        <div className="grid gap-x-6 gap-y-1 text-xs text-zinc-500 sm:grid-cols-2 xl:grid-cols-3">
                          <span>Category: {r.business_category || "-"}</span>
                          <span>QA status: {r.qa_status || "-"}</span>
                          <span>Duplicate score: {Number(r.duplicate_score || 0).toFixed(2)}{r.duplicate_of ? ` (of #${r.duplicate_of})` : ""}</span>
                          <span>Regenerated: {r.regenerate_count} · Image regen: {r.image_regen_count}</span>
                          <span>Image: {r.image_provider || "-"}{r.image_storage_provider ? ` → ${r.image_storage_provider}` : ""}</span>
                          <span>Publish: {r.post_id ? `${r.publish_provider}${r.external_id ? ` · ${r.external_id}` : ""}` : "not published"}</span>
                          <span>Created: {formatDate(r.created_at, true)}</span>
                          <span>Updated: {formatDate(r.updated_at, true)}</span>
                        </div>
                        {r.error_message ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{r.error_message}</p> : null}
                        <Link href={`/admin/gmb-posts/${r.id}`} className="inline-flex items-center gap-1 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
                          <Pencil className="h-3.5 w-3.5" /> Open editor (edit · approve · publish · image)
                        </Link>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </Table>
    </div>
  );
}
