"use client";

import { useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { Card, Button, Alert, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

/** Real-time GBP notifications (Pub/Sub) - one switch for every connected Google account. */
export function GbpNotificationsCard() {
  const { data, error, loading, reload } = useApi("/api/admin/gbp-notifications");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  async function run(action) {
    setBusy(action);
    setMsg(null);
    try {
      const r = await apiFetch("/api/admin/gbp-notifications", { body: { action } });
      const bad = r.results.filter((x) => !x.ok);
      setMsg({ tone: bad.length ? "amber" : "green", text: `${r.results.length - bad.length}/${r.results.length} account(s) updated.${bad.length ? ` Failed: ${bad.map((b) => `${b.account} (${b.error})`).join("; ")}` : ""}` });
      reload();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white"><BellRing className="h-4 w-4 text-[#F53236]" /> Real-time review notifications (Pub/Sub)</p>
          <p className="mt-1 max-w-2xl text-xs text-zinc-500">
            New/updated reviews, Google edits, duplicate and lost-ownership events arrive instantly. Setup: create a Pub/Sub topic, give
            <code className="mx-1">mybusiness-api-pubsub@system.gserviceaccount.com</code> the Publisher role, add a push subscription to
            <code className="mx-1">/api/gmb/pubsub?token=…</code>, save topic + token under Google below, then enable here. Without it, reviews sync every 30 minutes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={Boolean(busy) || data?.mock} onClick={() => run("disable")}>{busy === "disable" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Disable</Button>
          <Button disabled={Boolean(busy) || data?.mock || !data?.topic || !data?.tokenSet} onClick={() => run("enable")}>{busy === "enable" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enable for all accounts</Button>
        </div>
      </div>
      {error ? <Alert className="mt-3">{error}</Alert> : null}
      {msg ? <Alert tone={msg.tone} className="mt-3">{msg.text}</Alert> : null}
      {data?.mock ? <Alert tone="amber" className="mt-3">GMB provider is in mock mode - reviews use the 30-minute sync with sample data.</Alert> : null}
      {loading && !data ? null : data?.items?.length ? (
        <ul className="mt-3 space-y-1 text-xs">
          {data.items.map((a) => (
            <li key={a.account} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
              <span className="font-mono">{a.account} · {a.locations} location(s)</span>
              {a.error ? <Badge tone="red">error</Badge> : a.enabled ? <Badge tone="emerald">enabled</Badge> : <Badge>off</Badge>}
            </li>
          ))}
        </ul>
      ) : data && !data.mock ? <p className="mt-3 text-xs text-zinc-400">No Google-connected accounts yet.</p> : null}
    </Card>
  );
}
