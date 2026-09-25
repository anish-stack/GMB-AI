"use client";

import { useState } from "react";
import { Download, Mail } from "lucide-react";
import { Button } from "@/components/ui";

/** Download the CSV report, or email it straight to the GMB owner (client.google_email). */
export function GmbReportActions({ clientId, ownerEmail }) {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  async function sendToOwner() {
    setSending(true);
    setMsg("");
    try {
      const res = await fetch(`/api/gmb/${clientId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 30 }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Could not send the report");
      setMsg(`Sent to ${data.sent_to}`);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{msg}</span> : null}
      <a href={`/api/gmb/${clientId}/report?days=30`} download>
        <Button variant="secondary">
          <Download className="h-3.5 w-3.5" /> Download report
        </Button>
      </a>
      <Button onClick={sendToOwner} disabled={sending} title={ownerEmail || "No owner email on file yet"}>
        <Mail className="h-3.5 w-3.5" /> {sending ? "Sending..." : "Email report to owner"}
      </Button>
    </div>
  );
}
