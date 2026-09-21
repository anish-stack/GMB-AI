"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Deactivate / Reactivate / Delete controls for a client or GMB profile record.
 * patchUrl -> PATCH { action: "activate" | "deactivate" }
 * deleteUrl -> DELETE, then redirects to redirectTo on success
 */
export function DangerActions({ patchUrl, deleteUrl, active, redirectTo, deleteLabel = "Delete", deleteConfirm = "This cannot be undone. Continue?" }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function toggle() {
    setBusy("toggle");
    setError("");
    try {
      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: active ? "deactivate" : "activate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!window.confirm(deleteConfirm)) return;
    setBusy("delete");
    setError("");
    try {
      const res = await fetch(deleteUrl, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy("");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      <Button variant="secondary" onClick={toggle} disabled={!!busy}>
        {active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
        {busy === "toggle" ? "Working..." : active ? "Deactivate" : "Reactivate"}
      </Button>
      <Button variant="dangerGhost" onClick={remove} disabled={!!busy}>
        <Trash2 className="h-3.5 w-3.5" />
        {busy === "delete" ? "Deleting..." : deleteLabel}
      </Button>
    </div>
  );
}
