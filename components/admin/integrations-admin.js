"use client";

import { useState } from "react";
import { CheckCircle2, CircleDashed, Loader2, PlugZap, XCircle } from "lucide-react";
import { Card, Button, Input, Textarea, Alert, Skeleton, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";
import { GbpNotificationsCard } from "./gbp-notifications-card";

function IntegrationCard({ item, onChange }) {
  const [values, setValues] = useState({});
  const [enabled, setEnabled] = useState(item.enabled);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const dirty = Object.keys(values).length > 0 || enabled !== item.enabled;

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const r = await apiFetch(`/api/admin/integrations/${item.id}`, { method: "PUT", body: { enabled, values } });
      setValues({});
      onChange(r.item);
      setMsg({ tone: "green", text: "Saved. Secrets are encrypted at rest." });
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }
  async function test() {
    setBusy("test");
    setMsg(null);
    try {
      const r = await apiFetch(`/api/admin/integrations/${item.id}`, { body: {} });
      onChange(r.item);
      setMsg({ tone: r.result.status === "OK" ? "green" : "red", text: r.result.message });
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }

  const status = item.lastTest?.status;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
            {item.name}
            {item.configured ? <Badge tone="emerald">Configured</Badge> : <Badge>Not configured</Badge>}
            {item.source === "env" ? <Badge tone="blue">from .env</Badge> : null}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
            {status === "OK" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : status === "FAILED" ? <XCircle className="h-3.5 w-3.5 text-rose-500" /> : <CircleDashed className="h-3.5 w-3.5" />}
            {item.lastTest ? `Last test ${formatDate(item.lastTest.at, true)}: ${item.lastTest.message}` : "Never tested"}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-[#F53236]" /> Enabled
        </label>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {item.fields.map((f) => (
          <label key={f.key} className={f.multiline ? "sm:col-span-2" : ""}>
            <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{f.label}{f.secret ? " 🔒" : ""}</span>
            {f.multiline ? (
              <Textarea rows={3} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} placeholder={f.set ? f.masked : f.placeholder || ""} />
            ) : (
              <Input type={f.secret ? "password" : "text"} autoComplete="off" value={values[f.key] ?? (f.secret ? "" : f.value)} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} placeholder={f.secret && f.set ? f.masked : f.placeholder || ""} />
            )}
            {f.hint ? <span className="mt-1 block text-[11px] text-zinc-400">{f.hint}</span> : null}
            {f.secret && f.set ? <button type="button" className="mt-1 text-[11px] text-rose-600" onClick={() => setValues({ ...values, [f.key]: "__clear__" })}>Clear saved value</button> : null}
          </label>
        ))}
      </div>
      {msg ? <Alert tone={msg.tone} className="mt-3">{msg.text}</Alert> : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={test} disabled={busy === "test" || dirty}>{busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Test connection</Button>
        <Button onClick={save} disabled={!dirty || busy === "save"}>{busy === "save" ? "Saving…" : "Save"}</Button>
      </div>
    </Card>
  );
}

export function IntegrationsAdmin() {
  const { data, error, loading, mutate } = useApi("/api/admin/integrations");
  const items = data?.items || [];
  const groups = [...new Set(items.map((i) => i.group))];
  const onChange = (item) => mutate((d) => ({ ...d, items: d.items.map((i) => (i.id === item.id ? item : i)) }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Integrations & API keys</h1>
        <p className="text-sm text-zinc-500">Credentials are AES-256-GCM encrypted in the database, never sent to browsers, and override .env values at runtime.</p>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {loading && !items.length ? <Skeleton className="h-64" /> : null}
      {groups.map((g) => (
        <section key={g} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{g}</h2>
          {g === "Google" ? <GbpNotificationsCard /> : null}
          {items.filter((i) => i.group === g).map((i) => <IntegrationCard key={i.id} item={i} onChange={onChange} />)}
        </section>
      ))}
    </div>
  );
}
