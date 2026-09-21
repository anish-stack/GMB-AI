"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, RefreshCw, Unlink, Check } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Select } from "@/components/ui";

/**
 * Staff panel for one client's Google connection.
 * "Get connect link" produces a link you send to the client (WhatsApp/email).
 * The client opens it, signs in with THEIR Gmail, approves, done - after that
 * everything is managed from this panel with their stored token.
 */
export function GoogleConnect({ client }) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [locations, setLocations] = useState([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const connected = Boolean(client.google_connected_at);

  async function call(action, extra = {}) {
    setBusy(action);
    setMsg("");
    try {
      const res = await fetch("/api/gmb/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    } catch (err) {
      setMsg(err.message);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function getLink() {
    const data = await call("link");
    if (data?.link) setLink(data.link);
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function sync() {
    const data = await call("sync");
    if (data) {
      setLocations(data.locations || []);
      setMsg(`${data.accounts} account(s), ${data.locations.length} location(s) found.`);
      router.refresh();
    }
  }

  async function select(name) {
    const data = await call("select", { locationName: name });
    if (data) {
      setMsg(`Linked to ${data.linked}`);
      router.refresh();
    }
  }

  async function disconnect() {
    const data = await call("disconnect");
    if (data) {
      setLink("");
      setLocations([]);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader
        title="Google connection"
        subtitle="Your OAuth app, the client's Google account"
        action={
          <Badge tone={connected ? "emerald" : "amber"}>
            {connected ? "Connected" : "Not connected"}
          </Badge>
        }
      />
      <CardBody className="space-y-3 text-sm">
        {connected ? (
          <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <p>Google account: <span className="font-medium text-zinc-800 dark:text-zinc-100">{client.google_email || "unknown"}</span></p>
            <p>Location: <span className="font-mono">{client.google_location_name || "not selected"}</span></p>
          </div>
        ) : (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Send this link to the client. They sign in with their own Gmail and approve once - no panel
            login, no password sharing. The token is stored against this client only.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={getLink} disabled={busy === "link"}>
            <Link2 className="h-3.5 w-3.5" /> {connected ? "New connect link" : "Get connect link"}
          </Button>
          {connected ? (
            <>
              <Button variant="secondary" onClick={sync} disabled={busy === "sync"}>
                <RefreshCw className={busy === "sync" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Sync locations
              </Button>
              <Button variant="danger" onClick={disconnect} disabled={busy === "disconnect"}>
                <Unlink className="h-3.5 w-3.5" /> Disconnect
              </Button>
            </>
          ) : null}
        </div>

        {link ? (
          <div className="flex items-center gap-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-2">
            <input readOnly value={link} className="min-w-0 flex-1 bg-transparent font-mono text-xs text-zinc-700 dark:text-zinc-300" />
            <Button variant="secondary" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : null}

        {locations.length ? (
          <Select
            defaultValue={client.google_location_name || ""}
            onChange={(e) => select(e.target.value)}
            aria-label="Select the Google location"
          >
            <option value="">Select a location...</option>
            {locations.map((l) => (
              <option key={l.name} value={l.name}>
                {l.title} {l.address ? `- ${l.address}` : ""}
              </option>
            ))}
          </Select>
        ) : null}

        {msg ? <p className="text-xs text-zinc-600 dark:text-zinc-400">{msg}</p> : null}
      </CardBody>
    </Card>
  );
}
