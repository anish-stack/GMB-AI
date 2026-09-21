"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Button, Field, Input, Select } from "@/components/ui";

export function SettingsForm({ settings, plans }) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...settings,
    credit_costs: settings.credit_costs || {},
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCost = (k, v) =>
    setForm((f) => ({ ...f, credit_costs: { ...f.credit_costs, [k]: Number(v) } }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(json.error);
    setMsg("Settings saved");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {msg ? <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{msg}</p> : null}
      {err ? <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{err}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Platform" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Platform name"><Input value={form.platform_name || ""} onChange={(e) => set("platform_name", e.target.value)} /></Field>
            <Field label="Support email"><Input value={form.support_email || ""} onChange={(e) => set("support_email", e.target.value)} /></Field>
            <Field label="Currency"><Input value={form.currency || "INR"} onChange={(e) => set("currency", e.target.value)} /></Field>
            <Field label="Tax percent (GST)"><Input type="number" step="0.01" value={form.tax_percent} onChange={(e) => set("tax_percent", e.target.value)} /></Field>
            <Field label="Invoice prefix"><Input value={form.invoice_prefix || "INV"} onChange={(e) => set("invoice_prefix", e.target.value)} /></Field>
            <Field label="Grace days after due"><Input type="number" value={form.grace_days_past_due} onChange={(e) => set("grace_days_past_due", e.target.value)} /></Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Signup" subtitle="Controls the public /signup page" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Allow self signup">
              <Select value={String(form.allow_signup)} onChange={(e) => set("allow_signup", Number(e.target.value))}>
                <option value="1">Open - anyone can create an account</option>
                <option value="0">Closed - admin creates tenants</option>
              </Select>
            </Field>
            <Field label="Default plan on signup">
              <Select value={form.default_plan_slug || ""} onChange={(e) => set("default_plan_slug", e.target.value)}>
                {plans.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Default trial days"><Input type="number" value={form.default_trial_days} onChange={(e) => set("default_trial_days", e.target.value)} /></Field>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Credit cost per AI unit" subtitle="How many credits each agent call debits from the tenant wallet" />
        <CardBody className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {["research", "keyword", "topic", "content", "hashtag", "qa", "recommendation", "embedding", "image"].map((k) => (
            <Field key={k} label={k}>
              <Input type="number" value={form.credit_costs[k] ?? 0} onChange={(e) => setCost(k, e.target.value)} />
            </Field>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Payment gateway"
          subtitle="With the gateway off, invoices are settled manually from the Invoices screen and credit packs release instantly."
        />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <Field label="Razorpay">
            <Select value={String(form.razorpay_enabled)} onChange={(e) => set("razorpay_enabled", Number(e.target.value))}>
              <option value="0">Off - manual settlement</option>
              <option value="1">On - collect before releasing</option>
            </Select>
          </Field>
          <Field label="Key id"><Input value={form.razorpay_key_id || ""} onChange={(e) => set("razorpay_key_id", e.target.value)} /></Field>
          <Field label="Key secret"><Input type="password" value={form.razorpay_key_secret || ""} onChange={(e) => set("razorpay_key_secret", e.target.value)} /></Field>
        </CardBody>
      </Card>

      <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save settings"}</Button>
    </form>
  );
}
