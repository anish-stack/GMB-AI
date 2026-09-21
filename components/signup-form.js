"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input, Select } from "@/components/ui";

export function SignupForm({ plans, selected }) {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    plan_slug: selected || plans[0]?.slug,
    billing_cycle: "MONTHLY",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(json.error || "Could not create your account");
    router.push(json.redirect || "/dashboard");
    router.refresh();
  }

  const plan = plans.find((p) => p.slug === form.plan_slug);

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <Field label="Agency / company name">
        <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} required /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      </div>
      <Field label="Work email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></Field>
      <Field label="Password" hint="At least 6 characters">
        <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={6} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan">
          <Select value={form.plan_slug} onChange={(e) => set("plan_slug", e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.name} - ₹{p.price_monthly}/mo
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Billing cycle">
          <Select value={form.billing_cycle} onChange={(e) => set("billing_cycle", e.target.value)}>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </Select>
        </Field>
      </div>

      {plan ? (
        <p className="rounded-xl bg-zinc-50 px-3 py-2.5 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
          {plan.name}: {plan.max_clients < 0 ? "unlimited" : plan.max_clients} clients ·{" "}
          {plan.max_posts_month < 0 ? "unlimited" : plan.max_posts_month} posts/month · {plan.ai_credits_month} AI credits
          {plan.trial_days ? ` · ${plan.trial_days}-day trial` : ""}
        </p>
      ) : null}

      {err ? <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{err}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating workspace..." : "Create workspace"}
      </Button>
      <p className="text-center text-xs text-zinc-500">
        Already have an account? <Link href="/login" className="font-medium text-[#F53236]">Sign in</Link>
      </p>
    </form>
  );
}
