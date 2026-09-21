"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Table, EmptyRow, Badge, Button } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, truncate } from "@/lib/utils";

export function TaskQueueTable({ tasks, bulkEnabled = true, canPublish = true }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const selectableIds = useMemo(
    () => tasks.filter((t) => ["READY_FOR_REVIEW", "NEEDS_REVIEW"].includes(t.status)).map((t) => t.id),
    [tasks]
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkAction(action) {
    if (!selected.size) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, taskIds: [...selected] }),
      });
      const data = await res.json();
      setMsg(
        data.error
          ? data.error
          : `${data.succeeded} ${action === "approve" ? "approved" : "rejected"}${data.failed ? `, ${data.failed} failed` : ""}`
      );
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {bulkEnabled && selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-brand-50/60 px-4 py-2.5 dark:border-zinc-800 dark:bg-brand-500/5">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Button variant="success" onClick={() => bulkAction("approve")} disabled={busy} className="!py-1">
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button variant="danger" onClick={() => bulkAction("reject")} disabled={busy} className="!py-1">
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
            {msg ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{msg}</span> : null}
          </div>
        </div>
      ) : null}

      <Table
        head={["", "Client", "Topic", "Title", "Type", "AI score", "Status", "Updated", ""]}
        empty={!tasks.length ? <EmptyRow colSpan={9}>No tasks match this filter. Use &quot;Run AI job now&quot; to generate posts for today.</EmptyRow> : null}
      >
        {tasks.length > 0 ? (
          <tr className="bg-transparent">
            <td className="px-4 py-1.5" colSpan={9}>
              {selectableIds.length > 0 ? (
                <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-3.5 w-3.5 rounded border-zinc-300 text-[#F53236] focus:ring-brand-500/30" />
                  Select all reviewable
                </label>
              ) : null}
            </td>
          </tr>
        ) : null}
        {tasks.map((t) => {
          const canSelect = ["READY_FOR_REVIEW", "NEEDS_REVIEW"].includes(t.status);
          return (
            <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <td className="px-4 py-2">
                {canSelect ? (
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggleOne(t.id)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-[#F53236] focus:ring-brand-500/30"
                  />
                ) : null}
              </td>
              <td className="px-4 py-2">
                <p className="font-medium text-zinc-800 dark:text-zinc-100">{t.business_name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.city}</p>
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{truncate(t.topic, 30)}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{truncate(t.title, 40)}</td>
              <td className="px-4 py-2"><Badge>{t.post_type}</Badge></td>
              <td className="px-4 py-2">
                {t.qa_score === null ? <span className="text-xs text-zinc-400">-</span> :
                  <Badge tone={t.qa_score >= 80 ? "emerald" : "amber"}>{t.qa_score}/100</Badge>}
              </td>
              <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
              <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(t.updated_at, true)}</td>
              <td className="px-4 py-2 text-right">
                <Link href={`/gmb/tasks/${t.id}`} className="text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300">Open</Link>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
