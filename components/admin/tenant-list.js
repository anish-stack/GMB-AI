"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardBody, CardHeader, Table, EmptyRow, Badge, Button, Field, Input, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const EMPTY = {
  company_name: "", owner_name: "", email: "", password: "", phone: "",
  plan_id: "", billing_cycle: "MONTHLY", trial_days: 0,
};

export function TenantList({ tenants, plans }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY, plan_id: plans[0]?.id || "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [planSlug, setPlanSlug] = useState("");

  const filtered = tenants.filter((t) => {
    if (status && t.status !== status) return false;
    if (planSlug && t.plan_slug !== planSlug) return false;
    if (
      q &&
      !t.name.toLowerCase().includes(q.toLowerCase()) &&
      !String(t.owner_email || "").toLowerCase().includes(q.toLowerCase())
    )
      return false;
    return true;
  });

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(json.error || "Could not create the tenant");
    setForm({ ...EMPTY, plan_id: plans[0]?.id || "" });
    setOpen(false);
    router.refresh();
  }

  async function impersonate(tenantId) {
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    const json = await res.json();
    if (!res.ok) return setErr(json.error);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {err ? <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{err}</p> : null}

      <Card>
        <CardHeader
          title={`${filtered.length} tenants`}
          subtitle="Each tenant is one agency workspace with its own clients, team and wallet"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className="!w-40 !py-1.5" />
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-32">
                <option value="">All status</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
              <Select value={planSlug} onChange={(e) => setPlanSlug(e.target.value)} className="!w-36">
                <option value="">All plans</option>
                {plans.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
              </Select>
              <Button onClick={() => setOpen((o) => !o)}>
                <Plus className="h-3.5 w-3.5" /> {open ? "Close" : "New tenant"}
              </Button>
            </div>
          }
        />
        {open ? (
          <CardBody className="border-b border-zinc-100 dark:border-zinc-800">
            <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Company name"><Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} required /></Field>
              <Field label="Owner name"><Input value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)} required /></Field>
              <Field label="Owner email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></Field>
              <Field label="Password"><Input value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={6} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Plan">
                <Select value={form.plan_id} onChange={(e) => set("plan_id", e.target.value)}>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Billing cycle">
                <Select value={form.billing_cycle} onChange={(e) => set("billing_cycle", e.target.value)}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </Select>
              </Field>
              <Field label="Trial days"><Input type="number" min="0" value={form.trial_days} onChange={(e) => set("trial_days", e.target.value)} /></Field>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={busy}>{busy ? "Creating..." : "Create tenant"}</Button>
              </div>
            </form>
          </CardBody>
        ) : null}

        <Table head={["Tenant", "Owner", "Plan", "Status", "Clients", "Users", "Credits", "Renews", ""]}
          empty={!filtered.length ? <EmptyRow colSpan={9}>No tenants found.</EmptyRow> : null}>
          {filtered.map((t) => (
            <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <td className="px-4 py-2">
                <Link href={`/admin/tenants/${t.id}`} className="font-medium text-zinc-800 hover:text-[#F53236] dark:text-zinc-100">{t.name}</Link>
                <p className="text-xs text-zinc-400">{t.slug}</p>
              </td>
              <td className="px-4 py-2 text-xs text-zinc-500">{t.owner_name}<br />{t.owner_email}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                {t.plan_name || "-"}
                <span className="block text-xs text-zinc-400">{(t.billing_cycle || "").toLowerCase()}</span>
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap gap-1">
                  <Badge tone={t.status === "ACTIVE" ? "emerald" : "red"}>{t.status}</Badge>
                  {t.sub_status ? <Badge tone={t.sub_status === "ACTIVE" ? "blue" : "amber"}>{t.sub_status}</Badge> : null}
                </div>
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{t.client_count}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{t.user_count}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{Number(t.plan_credits || 0) + Number(t.purchased_credits || 0)}</td>
              <td className="px-4 py-2 text-xs text-zinc-500">{t.current_period_end ? formatDate(t.current_period_end) : "-"}</td>
              <td className="px-4 py-2 text-right">
                <div className="flex justify-end gap-1.5">
                  <Button variant="ghost" className="!py-1 text-xs" onClick={() => impersonate(t.id)}>View as</Button>
                  <Link href={`/admin/tenants/${t.id}`} className="rounded-xl px-2 py-1 text-xs font-medium text-[#F53236] hover:bg-zinc-100 dark:hover:bg-zinc-800">Manage</Link>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
