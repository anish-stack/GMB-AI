"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Check, Copy, KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Card, Button, Field, Input, Alert, Skeleton, EmptyState, PanelHeader, Modal, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";

function SecretOnce({ secret, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal open={Boolean(secret)} onClose={onClose} title="Copy your API key now" footer={<Button onClick={onClose}>I&apos;ve stored it</Button>}>
      <Alert tone="amber">This is the only time the full key is shown. Store it in your server&apos;s environment variables - never in browser code.</Alert>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-zinc-950 p-3">
        <code className="min-w-0 flex-1 break-all text-xs text-emerald-300">{secret}</code>
        <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(secret); setCopied(true); }}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </Modal>
  );
}

export function ApiKeysManager() {
  const { data, error, loading, reload } = useApi("/api/api-keys");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", scopes: ["clients:read", "posts:read"], expires_at: "" });
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [rename, setRename] = useState(null);

  async function act(key, fn) {
    setBusy(key);
    setMsg("");
    try {
      await fn();
      reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy("");
    }
  }

  const scopes = data?.scopes || {};
  const items = data?.items || [];
  const usage = data?.usage;
  const total30 = (usage?.byDay || []).reduce((s, d) => s + Number(d.requests), 0);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <PanelHeader icon={KeyRound} title="API keys" subtitle="Integrate posting, reviews and reports into your own website or app"
          actions={<>
            <Link href="/docs/api" target="_blank"><Button variant="secondary"><BookOpen className="h-4 w-4" /> Documentation</Button></Link>
            <Button disabled={!data?.apiAccess} onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Generate key</Button>
          </>} />
        <div className="space-y-4 p-4 sm:p-5">
          {data && !data.apiAccess ? <Alert tone="amber">Your plan doesn&apos;t include API access. <Link href="/billing" className="font-semibold underline">Upgrade</Link> to create keys.</Alert> : null}
          {error ? <Alert>{error}</Alert> : null}
          {msg ? <Alert>{msg}</Alert> : null}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60"><p className="text-xs text-zinc-500">Active keys</p><p className="text-xl font-bold">{items.filter((k) => k.active && !k.expired).length}</p></div>
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60"><p className="text-xs text-zinc-500">Requests (30d)</p><p className="text-xl font-bold">{total30.toLocaleString("en-IN")}</p></div>
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60"><p className="text-xs text-zinc-500">Throttled (30d)</p><p className="text-xl font-bold">{(usage?.byDay || []).reduce((s, d) => s + Number(d.throttled), 0)}</p></div>
          </div>
          {loading && !items.length ? <Skeleton className="h-24" /> : items.length ? (
            <ul className="space-y-2">
              {items.map((k) => (
                <li key={k.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                        {k.name}
                        {k.revoked ? <Badge tone="red">Revoked</Badge> : k.expired ? <Badge tone="amber">Expired</Badge> : k.active ? <Badge tone="emerald">Active</Badge> : <Badge>Disabled</Badge>}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-500">{k.prefix}_••••••••</p>
                      <div className="mt-2 flex flex-wrap gap-1">{k.scopes.map((s) => <span key={s} className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] dark:bg-zinc-800">{s}</span>)}</div>
                      <p className="mt-2 text-[11px] text-zinc-400">
                        Created {formatDate(k.created_at)} · Last used {k.last_used_at ? `${formatDate(k.last_used_at, true)}${k.last_used_ip ? ` from ${k.last_used_ip}` : ""}` : "never"} · {k.request_count.toLocaleString("en-IN")} requests
                        {k.expires_at ? ` · Expires ${formatDate(k.expires_at)}` : ""}{k.rate_limit_per_min ? ` · ${k.rate_limit_per_min}/min` : ""}
                      </p>
                    </div>
                    {!k.revoked ? (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" className="!py-1.5 text-xs" onClick={() => setRename({ id: k.id, name: k.name })}>Rename</Button>
                        <Button variant="secondary" className="!py-1.5 text-xs" disabled={busy === `a${k.id}`} onClick={() => act(`a${k.id}`, () => apiFetch(`/api/api-keys/${k.id}`, { method: "PATCH", body: { active: !k.active } }))}>{k.active ? "Disable" : "Enable"}</Button>
                        <Button variant="secondary" className="!py-1.5 text-xs" disabled={busy === `r${k.id}`} onClick={() => window.confirm("Regenerate? The current key stops working immediately.") && act(`r${k.id}`, async () => setSecret((await apiFetch(`/api/api-keys/${k.id}`, { body: { action: "regenerate" } })).key))}><RefreshCw className="h-3.5 w-3.5" /> Regenerate</Button>
                        <Button variant="dangerGhost" className="!py-1.5 text-xs" disabled={busy === `d${k.id}`} onClick={() => window.confirm(`Revoke "${k.name}"? This can't be undone.`) && act(`d${k.id}`, () => apiFetch(`/api/api-keys/${k.id}`, { method: "DELETE" }))}><Trash2 className="h-3.5 w-3.5" /> Revoke</Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={KeyRound} title="No API keys yet" text="Generate a key to call the API from your server." />}
        </div>
      </Card>

      {usage?.byEndpoint?.length ? (
        <Card className="p-5">
          <p className="mb-3 text-sm font-bold text-zinc-900 dark:text-white">Usage by endpoint (30 days)</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {usage.byEndpoint.map((e) => (
                <tr key={e.endpoint}><td className="py-2 font-mono text-xs">{e.endpoint}</td><td className="py-2 text-right">{Number(e.requests).toLocaleString("en-IN")}</td><td className="py-2 text-right text-xs text-rose-600">{Number(e.errors) ? `${e.errors} errors` : ""}</td><td className="py-2 text-right text-xs text-amber-600">{Number(e.throttled) ? `${e.throttled} throttled` : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title="Generate API key"
        footer={<Button disabled={busy === "new" || !form.name.trim()} onClick={() => act("new", async () => { const r = await apiFetch("/api/api-keys", { body: form }); setOpen(false); setSecret(r.key); setForm({ name: "", scopes: ["clients:read", "posts:read"], expires_at: "" }); })}>Generate</Button>}>
        <div className="space-y-4">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Agency website" maxLength={120} /></Field>
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Scopes</p>
            <div className="space-y-1.5">
              {Object.entries(scopes).map(([s, d]) => (
                <label key={s} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 accent-[#F53236]" checked={form.scopes.includes(s)} onChange={() => setForm((f) => ({ ...f, scopes: f.scopes.includes(s) ? f.scopes.filter((x) => x !== s) : [...f.scopes, s] }))} />
                  <span><code className="text-xs font-semibold">{s}</code> <span className="text-xs text-zinc-500">- {d}</span></span>
                </label>
              ))}
            </div>
          </div>
          <Field label="Expires (optional)"><Input type="date" value={form.expires_at} min={new Date().toLocaleDateString("en-CA")} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={Boolean(rename)} onClose={() => setRename(null)} title="Rename key"
        footer={<Button onClick={() => act("rn", async () => { await apiFetch(`/api/api-keys/${rename.id}`, { method: "PATCH", body: { name: rename.name } }); setRename(null); })}>Save</Button>}>
        {rename ? <Input value={rename.name} onChange={(e) => setRename({ ...rename, name: e.target.value })} maxLength={120} /> : null}
      </Modal>

      <SecretOnce secret={secret} onClose={() => setSecret("")} />
    </div>
  );
}
