"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Search, Tag, CheckCircle2, Ban, X } from "lucide-react";
import { Card, CardBody, CardHeader, Table, EmptyRow, Badge, Button, Field, Input, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const BLANK = {
  code: "", description: "", discount_type: "PERCENT", discount_value: 10,
  max_redemptions: 0, applies_to_plan_id: "", valid_from: "", valid_until: "", is_active: 1,
};

function StatCard({ icon, iconBg, label, value, sub }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] leading-tight text-zinc-500">{label}</p>
        <p className="text-lg font-semibold leading-tight text-zinc-900 dark:text-zinc-100">{value}</p>
        {sub ? <p className="truncate text-[11px] leading-tight text-zinc-400">{sub}</p> : null}
      </div>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl bg-white shadow-xl dark:bg-zinc-900`}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            {subtitle ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export function CouponManager({ coupons, plans }) {
  const router = useRouter();
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const rows = coupons.filter((c) => {
    if (status === "active" && !c.is_active) return false;
    if (status === "inactive" && c.is_active) return false;
    if (q && !c.code.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const activeCount = coupons.filter((c) => c.is_active).length;
  const totalRedeemed = coupons.reduce((s, c) => s + Number(c.redeemed_count || 0), 0);

  function openCreate() {
    setErr("");
    setForm(BLANK);
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(json.error);
    setForm(BLANK);
    setShowForm(false);
    router.refresh();
  }

  async function confirmRemove() {
    await fetch(`/api/admin/coupons/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    router.refresh();
  }

  async function toggle(c) {
    await fetch(`/api/admin/coupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, is_active: c.is_active ? 0 : 1 }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Coupons</h1>
          <p className="text-xs text-zinc-500">Discount codes applied at checkout on the invoice subtotal.</p>
        </div>
        <Button className="h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Coupon
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Tag className="h-4.5 w-4.5 text-blue-600" />} iconBg="bg-blue-50" label="Total Coupons" value={coupons.length} sub="Created so far" />
        <StatCard icon={<CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />} iconBg="bg-emerald-50" label="Active" value={activeCount} sub="Currently usable" />
        <StatCard icon={<Ban className="h-4.5 w-4.5 text-zinc-500" />} iconBg="bg-zinc-100" label="Disabled" value={coupons.length - activeCount} sub="Turned off" />
        <StatCard icon={<Tag className="h-4.5 w-4.5 text-amber-600" />} iconBg="bg-amber-50" label="Total Redemptions" value={totalRedeemed} sub="Across all coupons" />
      </div>

      <Card>
        <CardHeader
          title={`${rows.length} of ${coupons.length} coupons`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <Input placeholder="Search code..." value={q} onChange={(e) => setQ(e.target.value)} className="!w-40 !py-1.5 !pl-8" />
              </div>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-32 !py-1.5">
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Off</option>
              </Select>
            </div>
          }
        />
        <Table
          head={["Code", "Discount", "Plan", "Used", "Valid", "Status", ""]}
          empty={!rows.length ? <EmptyRow colSpan={7}>No coupons match this filter.</EmptyRow> : null}
        >
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2 font-mono text-sm font-medium text-zinc-800 dark:text-zinc-100">{c.code}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                {c.discount_type === "PERCENT" ? `${c.discount_value}%` : `₹${c.discount_value}`}
              </td>
              <td className="px-4 py-2 text-xs text-zinc-500">{c.plan_name || "Any"}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                {c.redeemed_count}{Number(c.max_redemptions) ? ` / ${c.max_redemptions}` : ""}
              </td>
              <td className="px-4 py-2 text-xs text-zinc-500">
                {c.valid_from ? formatDate(c.valid_from) : "any"} → {c.valid_until ? formatDate(c.valid_until) : "no end"}
              </td>
              <td className="px-4 py-2"><Badge tone={c.is_active ? "emerald" : "slate"}>{c.is_active ? "Active" : "Off"}</Badge></td>
              <td className="px-4 py-2 text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" className="!py-1 text-xs" onClick={() => toggle(c)}>{c.is_active ? "Disable" : "Enable"}</Button>
                  <Button variant="ghost" className="!py-1 text-rose-600" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {showForm ? (
        <Modal title="New coupon" subtitle="Applied at checkout on the invoice subtotal" onClose={() => setShowForm(false)} wide>
          {err ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p> : null}
          <form onSubmit={save} className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Code"><Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} required /></Field>
            <Field label="Description"><Input value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
            <Field label="Type">
              <Select value={form.discount_type} onChange={(e) => set("discount_type", e.target.value)}>
                <option value="PERCENT">Percent off</option>
                <option value="FLAT">Flat amount off</option>
              </Select>
            </Field>
            <Field label="Value"><Input type="number" step="0.01" value={form.discount_value} onChange={(e) => set("discount_value", e.target.value)} /></Field>
            <Field label="Max redemptions" hint="0 = unlimited"><Input type="number" value={form.max_redemptions} onChange={(e) => set("max_redemptions", e.target.value)} /></Field>
            <Field label="Limit to plan">
              <Select value={form.applies_to_plan_id} onChange={(e) => set("applies_to_plan_id", e.target.value)}>
                <option value="">Any plan</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Valid from"><Input type="date" value={form.valid_from} onChange={(e) => set("valid_from", e.target.value)} /></Field>
            <Field label="Valid until"><Input type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} /></Field>
            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 sm:col-span-2 lg:col-span-4 dark:border-zinc-800">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Create coupon"}</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteId ? (
        <Modal title="Delete coupon?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">This coupon will no longer be redeemable at checkout.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmRemove}>Delete</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}