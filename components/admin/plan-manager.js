"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Button, Field, Input, Select, Textarea, Badge } from "@/components/ui";
import { LIMIT_KEYS, FEATURE_KEYS, LIMIT_LABEL, FEATURE_LABEL } from "@/lib/saas/constants.js";

const BLANK = {
  name: "", slug: "", tagline: "", description: "", currency: "INR",
  price_monthly: 0, price_yearly: 0, trial_days: 0, credit_rollover: 0,
  max_clients: 2, max_team_members: 1, max_gmb_profiles: 2, max_posts_month: 10,
  max_scheduled_posts: 10, max_keywords_client: 25, ai_credits_month: 300,
  f_image_generation: 1, f_bulk_actions: 0, f_advanced_analytics: 0, f_api_access: 0,
  f_white_label: 0, f_google_publish: 0, f_auto_publish: 0, f_priority_support: 0, f_export_reports: 0,
  highlights: "", is_public: 1, is_active: 1, sort_order: 0,
};

export function PlanManager({ plans }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function edit(p) {
    setEditing(p.id);
    setForm({ ...p, highlights: (p.highlights || []).join("\n") });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch(editing ? `/api/admin/plans/${editing}` : "/api/admin/plans", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(json.error || "Save failed");
    setEditing(null);
    setForm(BLANK);
    router.refresh();
  }

  async function remove(id) {
    if (!confirm("Delete this plan? If tenants are on it, it is archived instead.")) return;
    await fetch(`/api/admin/plans/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {err ? <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{err}</p> : null}

      <Card>
        <CardHeader
          title={editing ? `Edit plan #${editing}` : "Create a plan"}
          subtitle="Set -1 on any limit for unlimited"
          action={
            editing ? (
              <Button variant="secondary" onClick={() => { setEditing(null); setForm(BLANK); }}>Cancel edit</Button>
            ) : null
          }
        />
        <CardBody>
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Plan name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} required /></Field>
              <Field label="Slug" hint="auto from name if blank"><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
              <Field label="Tagline"><Input value={form.tagline || ""} onChange={(e) => set("tagline", e.target.value)} /></Field>
              <Field label="Sort order"><Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></Field>
              <Field label="Monthly price (₹)"><Input type="number" step="0.01" value={form.price_monthly} onChange={(e) => set("price_monthly", e.target.value)} /></Field>
              <Field label="Yearly price (₹)"><Input type="number" step="0.01" value={form.price_yearly} onChange={(e) => set("price_yearly", e.target.value)} /></Field>
              <Field label="Trial days"><Input type="number" value={form.trial_days} onChange={(e) => set("trial_days", e.target.value)} /></Field>
              <Field label="Credit rollover">
                <Select value={form.credit_rollover ? "1" : "0"} onChange={(e) => set("credit_rollover", Number(e.target.value))}>
                  <option value="0">Unused credits expire</option>
                  <option value="1">Unused credits roll over</option>
                </Select>
              </Field>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Limits (-1 = unlimited)</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {LIMIT_KEYS.map((k) => (
                  <Field key={k} label={LIMIT_LABEL[k]}>
                    <Input type="number" value={form[k]} onChange={(e) => set(k, e.target.value)} />
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Features</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURE_KEYS.map((k) => (
                  <label key={k} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/60">
                    <input
                      type="checkbox"
                      checked={Boolean(Number(form[k]))}
                      onChange={(e) => set(k, e.target.checked ? 1 : 0)}
                      className="h-4 w-4 accent-[#F53236]"
                    />
                    <span className="text-zinc-700 dark:text-zinc-200">{FEATURE_LABEL[k]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Highlights (one per line)">
                <Textarea value={form.highlights} onChange={(e) => set("highlights", e.target.value)} />
              </Field>
              <div className="space-y-3">
                <Field label="Description"><Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} /></Field>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(Number(form.is_public))} onChange={(e) => set("is_public", e.target.checked ? 1 : 0)} className="h-4 w-4 accent-[#F53236]" />
                    Show on pricing page
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(Number(form.is_active))} onChange={(e) => set("is_active", e.target.checked ? 1 : 0)} className="h-4 w-4 accent-[#F53236]" />
                    Active
                  </label>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={busy}>{busy ? "Saving..." : editing ? "Update plan" : "Create plan"}</Button>
          </form>
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader
              title={p.name}
              subtitle={`₹${p.price_monthly}/mo · ₹${p.price_yearly}/yr`}
              action={
                <div className="flex gap-1">
                  <Button variant="ghost" className="!py-1 text-xs" onClick={() => edit(p)}>Edit</Button>
                  <Button variant="ghost" className="!py-1 text-rose-600" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              }
            />
            <CardBody className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-1">
                <Badge tone={p.is_active ? "emerald" : "slate"}>{p.is_active ? "Active" : "Archived"}</Badge>
                <Badge tone={p.is_public ? "blue" : "slate"}>{p.is_public ? "Public" : "Hidden"}</Badge>
                {p.trial_days ? <Badge tone="amber">{p.trial_days}-day trial</Badge> : null}
              </div>
              <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                {LIMIT_KEYS.map((k) => (
                  <li key={k}>{LIMIT_LABEL[k]}: <b>{Number(p[k]) < 0 ? "Unlimited" : p[k]}</b></li>
                ))}
              </ul>
              <p className="text-xs text-zinc-500">
                {FEATURE_KEYS.filter((f) => p[f]).map((f) => FEATURE_LABEL[f]).join(" · ") || "No extra features"}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
