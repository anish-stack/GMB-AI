"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Table, EmptyRow, Badge, Button, Field, Input, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const BLANK = {
  code: "", description: "", discount_type: "PERCENT", discount_value: 10,
  max_redemptions: 0, applies_to_plan_id: "", valid_from: "", valid_until: "", is_active: 1,
};

export function CouponManager({ coupons, plans }) {
  const router = useRouter();
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const rows = coupons.filter((c) => {
    if (status === "active" && !c.is_active) return false;
    if (status === "inactive" && c.is_active) return false;
    if (q && !c.code.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

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
    router.refresh();
  }

  async function remove(id) {
    if (!confirm("Delete this coupon?")) return;
    await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
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
    <div className="space-y-5">
      {err ? <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{err}</p> : null}
      <Card>
        <CardHeader title="New coupon" subtitle="Applied at checkout on the invoice subtotal" />
        <CardBody>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={busy}><Plus className="h-3.5 w-3.5" /> {busy ? "Saving..." : "Create coupon"}</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`${rows.length} of ${coupons.length} coupons`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input placeholder="Search code..." value={q} onChange={(e) => setQ(e.target.value)} className="!w-40 !py-1.5" />
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-32">
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Off</option>
              </Select>
            </div>
          }
        />
        <Table head={["Code", "Discount", "Plan", "Used", "Valid", "Status", ""]}
          empty={!rows.length ? <EmptyRow colSpan={7}>No coupons match this filter.</EmptyRow> : null}>
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
                  <Button variant="ghost" className="!py-1 text-rose-600" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
