"use client";

import { useMemo, useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { Card, CardHeader, CardBody, Button, Field, Input, Textarea, Select, Alert, Skeleton, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";

export function NotificationsAdmin() {
  const { data, error, loading, reload } = useApi("/api/admin/notifications");
  const [form, setForm] = useState({ type: "ANNOUNCEMENT", title: "", body: "", link: "", audience_type: "ALL", push: true });
  const [ids, setIds] = useState([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const options = useMemo(() => {
    const list = form.audience_type === "TENANTS" ? (data?.tenants || []).map((t) => ({ id: t.id, label: t.name })) : (data?.users || []).map((u) => ({ id: u.id, label: `${u.name} · ${u.email} (${u.tenant})` }));
    const f = filter.toLowerCase();
    return f ? list.filter((o) => o.label.toLowerCase().includes(f)) : list;
  }, [data, form.audience_type, filter]);

  async function send() {
    if (!window.confirm(`Send "${form.title}" to ${form.audience_type === "ALL" ? "ALL tenants" : `${ids.length} recipient(s)`}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiFetch("/api/admin/notifications", { body: { ...form, ids } });
      setMsg({ tone: "green", text: `Delivered to ${r.recipients} user(s) · push sent ${r.push.sent}, failed ${r.push.failed}, skipped ${r.push.skipped}` });
      setForm({ ...form, title: "", body: "", link: "" });
      setIds([]);
      reload();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"><Megaphone className="h-5 w-5" /> Notifications</h1>
      <Card>
        <CardHeader title="Send a notification" subtitle="Appears in the notification center and as a push notification on registered devices." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{["ANNOUNCEMENT", "MAINTENANCE", "ALERT", "INFO"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Audience">
            <Select value={form.audience_type} onChange={(e) => { setForm({ ...form, audience_type: e.target.value }); setIds([]); }}>
              <option value="ALL">All tenants (every active user)</option>
              <option value="TENANTS">Selected tenants</option>
              <option value="USERS">Selected users</option>
            </Select>
          </Field>
          <Field label="Title" className="sm:col-span-2"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={220} /></Field>
          <Field label="Message" className="sm:col-span-2"><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} maxLength={1000} /></Field>
          <Field label="Link (optional, in-app path)"><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/billing" /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={form.push} onChange={(e) => setForm({ ...form, push: e.target.checked })} className="accent-[#F53236]" /> Also send push notification</label>
          {form.audience_type !== "ALL" ? (
            <div className="sm:col-span-2">
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" />
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
                {options.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <input type="checkbox" className="accent-[#F53236]" checked={ids.includes(o.id)} onChange={() => setIds((l) => (l.includes(o.id) ? l.filter((x) => x !== o.id) : [...l, o.id]))} /> {o.label}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{ids.length} selected</p>
            </div>
          ) : null}
          {msg ? <Alert tone={msg.tone} className="sm:col-span-2">{msg.text}</Alert> : null}
          <div className="sm:col-span-2"><Button onClick={send} disabled={busy || form.title.trim().length < 3 || (form.audience_type !== "ALL" && !ids.length)}><Send className="h-4 w-4" /> {busy ? "Sending…" : "Send"}</Button></div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Sent notifications" />
        <CardBody>
          {error ? <Alert>{error}</Alert> : null}
          {loading && !data ? <Skeleton className="h-32" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="text-left text-xs text-zinc-500"><th className="py-2">Sent</th><th>Type</th><th>Title</th><th>Audience</th><th>Recipients</th><th>Push</th><th>Read</th></tr></thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(data?.items || []).map((b) => (
                    <tr key={b.id}>
                      <td className="py-2 text-xs text-zinc-500">{formatDate(b.created_at, true)}<div>{b.created_by_name}</div></td>
                      <td><Badge tone={b.type === "MAINTENANCE" ? "amber" : b.type === "ALERT" ? "red" : "indigo"}>{b.type}</Badge></td>
                      <td className="max-w-xs"><p className="truncate font-medium">{b.title}</p><p className="truncate text-xs text-zinc-500">{b.body}</p></td>
                      <td className="text-xs">{b.audience_type}{b.audience_type !== "ALL" ? ` (${b.audience.length})` : ""}</td>
                      <td className="text-xs">{b.recipients}</td>
                      <td className="text-xs">{b.send_push ? `${b.push_sent} sent / ${b.push_failed} failed` : "off"}</td>
                      <td className="text-xs">{b.read_total} ({b.recipients ? Math.round((b.read_total / b.recipients) * 100) : 0}%)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
