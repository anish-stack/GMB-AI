"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Trash2 } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { TASK_STATUS } from "@/lib/constants";

/** Shared caller for /api/admin/gmb-posts. Handles the force-delete retry prompt. */
export async function adminPostAction(action, ids, extra = {}) {
  const run = async (body) => {
    const res = await fetch("/api/admin/gmb-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Action failed");
    return data;
  };
  let data = await run(extra);
  if (action === "delete" && !extra.force) {
    const blocked = data.results.filter((r) => !r.ok && r.code === "REMOTE_DELETE_FAILED");
    if (blocked.length && window.confirm(`${blocked.length} live post(s) could not be removed from GMB.\n\n${blocked[0].error}\n\nDelete them locally anyway?`)) {
      const retry = await run({ ...extra, force: true, ids: blocked.map((b) => b.id) });
      data = {
        ...data,
        succeeded: data.succeeded + retry.succeeded,
        failed: data.failed - retry.succeeded,
        results: [...data.results.filter((r) => !blocked.some((b) => b.id === r.id)), ...retry.results],
      };
    }
  }
  return data;
}

/** Super-admin-only toolbar shown above the post editor. */
export function AdminPostToolbar({ taskId, status, tenantName }) {
  const router = useRouter();
  const [next, setNext] = useState(status);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);

  async function run(action, extra = {}) {
    setBusy(action);
    setMsg(null);
    try {
      const data = await adminPostAction(action, [taskId], extra);
      const r = data.results[0];
      if (!r?.ok) throw new Error(r?.error || "Action failed");
      if (action === "delete") {
        router.push("/admin/gmb-posts");
        router.refresh();
        return;
      }
      // Editor below keeps its own state - full reload so it shows the new status.
      window.location.reload();
    } catch (err) {
      setMsg({ tone: "err", text: err.message });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 dark:border-violet-900/50 dark:bg-violet-950/30">
      <div className="flex items-center gap-2 text-sm text-violet-800 dark:text-violet-200">
        <ShieldAlert className="h-4 w-4" />
        <span>Super admin · full access{tenantName ? ` · tenant: ${tenantName}` : ""}</span>
        {msg ? <span className={msg.tone === "ok" ? "text-emerald-700" : "text-rose-600"}>— {msg.text}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={next} onChange={(e) => setNext(e.target.value)} className="!w-48 !py-1.5 !text-xs">
          {Object.keys(TASK_STATUS).map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
        </Select>
        <Button variant="secondary" className="!py-1.5 text-xs" disabled={busy || next === status} onClick={() => run("set_status", { status: next })}>
          {busy === "set_status" ? "Saving..." : "Force status"}
        </Button>
        <Button
          variant="danger"
          className="!py-1.5 text-xs"
          disabled={!!busy}
          onClick={() => window.confirm(`Permanently delete post #${taskId}? Live post (if any) is removed from GMB and all images are deleted. This cannot be undone.`) && run("delete")}
        >
          <Trash2 className="h-3.5 w-3.5" /> {busy === "delete" ? "Deleting..." : "Delete permanently"}
        </Button>
      </div>
    </div>
  );
}
