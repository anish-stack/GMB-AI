"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { POST_TYPES } from "@/lib/constants";

/** Creates a task for one client and runs the full AI pipeline immediately. */
export function GenerateNow({ clientId }) {
  const router = useRouter();
  const [postType, setPostType] = useState("Service");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, postType }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
      router.push(`/gmb/tasks/${data.taskId}`);
    } catch (err) {
      setMsg(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className="text-xs text-red-600">{msg}</span> : null}
      <Select value={postType} onChange={(e) => setPostType(e.target.value)} className="w-44" aria-label="Post type">
        {POST_TYPES.map((t) => <option key={t}>{t}</option>)}
      </Select>
      <Button onClick={run} disabled={busy}>
        <Sparkles className="h-3.5 w-3.5" /> {busy ? "Generating..." : "Generate post"}
      </Button>
    </div>
  );
}
