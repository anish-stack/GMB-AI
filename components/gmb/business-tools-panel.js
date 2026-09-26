"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, Check, Link2, ListChecks, Loader2, Plus, Save, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Card, Button, Field, Input, Select, Alert, Skeleton, EmptyState, PanelHeader, Badge } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/hooks/use-api";

function useAction() {
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null); // { tone, text }
  async function run(key, fn, okText) {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      if (okText) setMsg({ tone: "green", text: okText });
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy(null);
    }
  }
  return { busy, msg, run };
}

const MockNote = ({ show }) =>
  show ? <Alert tone="amber">Mock mode - changes stay in this app until the listing is connected to Google.</Alert> : null;

/* ================= ATTRIBUTES ================= */
function AttributeInput({ a, value, onChange }) {
  if (a.type === "BOOL") {
    return (
      <div className="flex gap-1" role="radiogroup" aria-label={a.label}>
        {[[true, "Yes"], [false, "No"], [null, "—"]].map(([v, l]) => (
          <button key={l} type="button" onClick={() => onChange(v)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${value === v ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-white dark:text-zinc-900" : "text-zinc-600 ring-zinc-200 dark:text-zinc-300 dark:ring-zinc-700"}`}>
            {l}
          </button>
        ))}
      </div>
    );
  }
  if (a.type === "ENUM") {
    return (
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="!w-auto min-w-40 text-xs">
        <option value="">Not set</option>
        {a.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    );
  }
  if (a.type === "REPEATED_ENUM") {
    const set = new Set(value || []);
    return (
      <div className="flex flex-wrap gap-1.5">
        {a.options.map((o) => {
          const on = set.has(o.value);
          return (
            <button key={o.value} type="button"
              onClick={() => onChange(on ? [...set].filter((x) => x !== o.value) : [...set, o.value])}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${on ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300" : "text-zinc-600 ring-zinc-200 dark:text-zinc-300 dark:ring-zinc-700"}`}>
              {on ? <Check className="h-3 w-3" /> : null}{o.label}
            </button>
          );
        })}
      </div>
    );
  }
  if (a.type === "URL") {
    return <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="https://" className="sm:!w-72 text-xs" />;
  }
  return <span className="text-xs text-zinc-400">Unsupported type</span>;
}

function AttributesCard({ clientId }) {
  const { data, error, loading, mutate } = useApi(`/api/gmb/${clientId}/attributes`);
  const [draft, setDraft] = useState({});
  const [q, setQ] = useState("");
  const { busy, msg, run } = useAction();

  const items = useMemo(() => data?.items || [], [data]);
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const map = new Map();
    for (const a of items) {
      if (term && !`${a.label} ${a.group}`.toLowerCase().includes(term)) continue;
      if (!map.has(a.group)) map.set(a.group, []);
      map.get(a.group).push(a);
    }
    return [...map.entries()];
  }, [items, q]);
  const dirty = Object.keys(draft);

  const save = () =>
    run("save", async () => {
      const attributes = items.filter((a) => a.id in draft).map((a) => ({ id: a.id, type: a.type, value: draft[a.id] }));
      await apiFetch(`/api/gmb/${clientId}/attributes`, { method: "PATCH", body: { attributes } });
      mutate((d) => ({ ...d, items: d.items.map((a) => (a.id in draft ? { ...a, value: draft[a.id] } : a)) }));
      setDraft({});
    }, "Attributes saved to the listing.");

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={ListChecks}
        tone="blue"
        title="Attributes"
        subtitle="Amenities, accessibility, payments - shown on Maps and used as search filters"
        actions={
          <Button onClick={save} disabled={!dirty.length || busy === "save"}>
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save{dirty.length ? ` (${dirty.length})` : ""}
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-5">
        <MockNote show={data?.is_mock} />
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        {items.length > 12 ? <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search attributes..." /> : null}
        {loading && !items.length ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : groups.length ? (
          groups.map(([group, list]) => (
            <section key={group}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{group}</h3>
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {list.map((a) => {
                  const value = a.id in draft ? draft[a.id] : a.value;
                  return (
                    <li key={a.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm text-zinc-800 dark:text-zinc-200">
                        {a.label}
                        {a.id in draft ? <span className="ml-2 text-[10px] font-semibold text-amber-600">edited</span> : null}
                      </span>
                      <AttributeInput a={a} value={value} onChange={(v) => setDraft((d) => ({ ...d, [a.id]: v }))} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        ) : (
          <EmptyState icon={ListChecks} title="No attributes available" text="Google decides attributes per business category." />
        )}
      </div>
    </Card>
  );
}

/* ================= ACTION LINKS ================= */
function ActionLinksCard({ clientId }) {
  const { data, error, loading, reload } = useApi(`/api/gmb/${clientId}/action-links`);
  const [form, setForm] = useState({ type: "", uri: "", preferred: true });
  const { busy, msg, run } = useAction();
  const types = data?.types || [];
  const items = data?.items || [];
  const label = (v) => types.find((t) => t.value === v)?.label || v;
  const type = form.type || types[0]?.value || "";

  const add = () =>
    run("add", async () => {
      await apiFetch(`/api/gmb/${clientId}/action-links`, { body: { ...form, type } });
      setForm({ type: "", uri: "", preferred: true });
      reload();
    }, "Button link added.");
  const remove = (id) =>
    window.confirm("Remove this link from the listing?") &&
    run(id, async () => {
      await apiFetch(`/api/gmb/${clientId}/action-links/${encodeURIComponent(id)}`, { method: "DELETE" });
      reload();
    });
  const prefer = (id) =>
    run(id, async () => {
      await apiFetch(`/api/gmb/${clientId}/action-links/${encodeURIComponent(id)}`, { method: "PATCH", body: { preferred: true } });
      reload();
    });

  return (
    <Card className="overflow-hidden">
      <PanelHeader icon={CalendarCheck} tone="green" title="Booking & order buttons" subtitle="Adds Book / Order / Reserve buttons directly on the Google listing" />
      <div className="space-y-4 p-4 sm:p-5">
        <MockNote show={data?.is_mock} />
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

        {types.length ? (
          <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
            <Field label="Button">
              <Select value={type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Link (https)">
              <Input value={form.uri} onChange={(e) => setForm((f) => ({ ...f, uri: e.target.value }))} placeholder="https://booking.example.com" inputMode="url" />
            </Field>
            <Button onClick={add} disabled={busy === "add" || !form.uri.trim()}>
              {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </Button>
          </div>
        ) : !loading ? (
          <Alert tone="blue">Google offers no booking/order button types for this category.</Alert>
        ) : null}

        {loading && !items.length ? (
          <Skeleton className="h-14" />
        ) : items.length ? (
          <ul className="space-y-2">
            {items.map((l) => (
              <li key={l.id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 sm:flex-row sm:items-center dark:border-zinc-800">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label(l.type)}</span>
                    {l.preferred ? <Badge tone="green">Preferred</Badge> : null}
                    {!l.editable ? <Badge>{l.provider === "AGGREGATOR_3P" ? "Partner" : "Read-only"}</Badge> : null}
                  </div>
                  <a href={l.uri} target="_blank" rel="noreferrer" className="block truncate text-xs text-sky-600 hover:underline dark:text-sky-400">{l.uri}</a>
                </div>
                {l.editable ? (
                  <div className="flex gap-2">
                    {!l.preferred ? <Button variant="secondary" className="!py-1.5 text-xs" onClick={() => prefer(l.id)} disabled={busy === l.id}>Make preferred</Button> : null}
                    <Button variant="dangerGhost" className="!py-1.5 text-xs" onClick={() => remove(l.id)} disabled={busy === l.id}>
                      {busy === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Link2} title="No booking buttons yet" text="Add your appointment or ordering page so customers act straight from Google." />
        )}
      </div>
    </Card>
  );
}

/* ================= ADMINS ================= */
const ROLES = [
  ["MANAGER", "Manager"],
  ["OWNER", "Owner"],
  ["SITE_MANAGER", "Site manager"],
];

function AdminsCard({ clientId }) {
  const { data, error, loading, reload } = useApi(`/api/gmb/${clientId}/admins`);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MANAGER");
  const { busy, msg, run } = useAction();
  const items = data?.items || [];

  const invite = () =>
    run("invite", async () => {
      await apiFetch(`/api/gmb/${clientId}/admins`, { body: { email: email.trim(), role } });
      setEmail("");
      reload();
    }, "Invitation sent. It shows as pending until accepted in Google.");
  const remove = (a) =>
    window.confirm(`Remove ${a.email || "this user"} from the listing?`) &&
    run(a.id, async () => {
      await apiFetch(`/api/gmb/${clientId}/admins/${encodeURIComponent(a.id)}`, { method: "DELETE" });
      reload();
    });

  return (
    <Card className="overflow-hidden">
      <PanelHeader icon={ShieldCheck} tone="red" title="Listing access" subtitle="Invite your agency Google account as Manager - no need to log in to each client's Gmail" />
      <div className="space-y-4 p-4 sm:p-5">
        <MockNote show={data?.is_mock} />
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agency@gmail.com" />
          </Field>
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Button onClick={invite} disabled={busy === "invite" || !email.includes("@")}>
            {busy === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Invite
          </Button>
        </div>
        {loading && !items.length ? (
          <Skeleton className="h-14" />
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {items.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-800 dark:text-zinc-200">{a.email || "Google account"}</p>
                  <p className="text-[11px] text-zinc-400">{String(a.role || "").replaceAll("_", " ").toLowerCase()}{a.pending ? " · invitation pending" : ""}</p>
                </div>
                {a.role !== "PRIMARY_OWNER" ? (
                  <Button variant="ghost" className="!p-2 text-rose-600" aria-label="Remove" onClick={() => remove(a)} disabled={busy === a.id}>
                    {busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                ) : <Badge tone="indigo">Primary owner</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function BusinessToolsPanel({ clientId, canConnect = true }) {
  return (
    <div className="space-y-5">
      <ActionLinksCard clientId={clientId} />
      <AttributesCard clientId={clientId} />
      {canConnect ? <AdminsCard clientId={clientId} /> : null}
    </div>
  );
}
