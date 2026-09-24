"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X, Search, Layers, CheckCircle2, Users, IndianRupee } from "lucide-react";
import { Card, CardBody, Button, Field, Input, Select, Textarea } from "@/components/ui";
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

const ACCENTS = [
  { bar: "before:bg-zinc-400", chip: "bg-zinc-100 text-zinc-600" },
  { bar: "before:bg-blue-500", chip: "bg-blue-50 text-blue-600" },
  { bar: "before:bg-violet-500", chip: "bg-violet-50 text-violet-600" },
  { bar: "before:bg-amber-500", chip: "bg-amber-50 text-amber-600" },
];

function StatCard({ icon, iconBg, label, value, sub }) {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
          <p className="text-xs text-zinc-400">{sub}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function PlanManager({ plans }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name_asc");

  const totalPlans = plans.length;
  const activePlans = plans.filter((p) => p.is_active).length;
  const totalClients = plans.reduce((s, p) => s + (Number(p.client_count) || 0), 0);
  const monthlyRevenue = plans.reduce((s, p) => s + (Number(p.price_monthly) || 0) * (Number(p.client_count) || 0), 0);

  const filtered = useMemo(() => {
    let list = [...plans];
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((p) => p.name?.toLowerCase().includes(s) || p.slug?.toLowerCase().includes(s) || p.tagline?.toLowerCase().includes(s));
    }
    if (status !== "all") list = list.filter((p) => (status === "active" ? p.is_active : !p.is_active));
    list.sort((a, b) => {
      if (sort === "name_asc") return (a.name || "").localeCompare(b.name || "");
      if (sort === "name_desc") return (b.name || "").localeCompare(a.name || "");
      if (sort === "price_asc") return (a.price_monthly || 0) - (b.price_monthly || 0);
      if (sort === "price_desc") return (b.price_monthly || 0) - (a.price_monthly || 0);
      return 0;
    });
    return list;
  }, [plans, q, status, sort]);

  function openCreate() {
    setEditing(null);
    setForm(BLANK);
    setErr("");
    setShowModal(true);
  }

  function openEdit(p) {
    setEditing(p.id);
    setForm({ ...p, highlights: (p.highlights || []).join("\n") });
    setErr("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(BLANK);
    setErr("");
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
    closeModal();
    router.refresh();
  }

  async function confirmDelete() {
    await fetch(`/api/admin/plans/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Plans &amp; Packaging</h1>
        <p className="text-sm text-zinc-500">Create and manage subscription plans for every resource on the platform.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Layers className="h-5 w-5 text-blue-600" />} iconBg="bg-blue-50" label="Total Plans" value={totalPlans} sub="Active subscription plans" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-50" label="Active Plans" value={activePlans} sub="Currently active" />
        <StatCard icon={<Users className="h-5 w-5 text-violet-600" />} iconBg="bg-violet-50" label="Total Clients" value={totalClients} sub="Across all plans" />
        <StatCard icon={<IndianRupee className="h-5 w-5 text-amber-600" />} iconBg="bg-amber-50" label="Monthly Revenue" value={`₹${monthlyRevenue.toLocaleString("en-IN")}`} sub="From active clients" />
      </div>

      {err ? <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{err}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input className="pl-9" placeholder="Search plans by name, slug or tag..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex  items-center gap-2">
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto">
            <option value="name_asc">Sort by: Name (A-Z)</option>
            <option value="name_desc">Sort by: Name (Z-A)</option>
            <option value="price_asc">Sort by: Price (Low-High)</option>
            <option value="price_desc">Sort by: Price (High-Low)</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Create Plan</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {filtered.map((p, i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          const features = FEATURE_KEYS.filter((f) => p[f]);
          const shownFeatures = features.slice(0, 2);
          const moreCount = features.length - shownFeatures.length;
          return (
            <Card
              key={p.id}
              className={`relative overflow-hidden before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:content-[''] ${accent.bar}`}
            >
              <CardBody className="space-y-3 pl-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      ₹{Number(p.price_monthly).toLocaleString("en-IN")}
                      <span className="text-xs font-normal text-zinc-400"> / month</span>
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.is_active ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"}`}>
                    {p.is_active ? "Active" : "Archived"}
                  </span>
                </div>

                {p.tagline ? <p className="text-xs text-zinc-500">{p.tagline}</p> : null}

                <div className="flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.is_public ? "bg-blue-50 text-blue-600" : "bg-zinc-100 text-zinc-500"}`}>
                    {p.is_public ? "Public" : "Hidden"}
                  </span>
                  {p.trial_days ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">{p.trial_days}-day trial</span>
                  ) : null}
                </div>

                <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                  {LIMIT_KEYS.map((k) => (
                    <li key={k} className="flex justify-between">
                      <span>{LIMIT_LABEL[k]}</span>
                      <b className="text-zinc-900 dark:text-zinc-100">{Number(p[k]) < 0 ? "Unlimited" : p[k]}</b>
                    </li>
                  ))}
                </ul>

                {features.length ? (
                  <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    {shownFeatures.map((f) => (
                      <span key={f} className={`rounded-full px-2 py-0.5 text-xs font-medium ${accent.chip}`}>{FEATURE_LABEL[f]}</span>
                    ))}
                    {moreCount > 0 ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">+{moreCount} more</span> : null}
                  </div>
                ) : null}

                <div className="flex gap-2 pt-1">
                  <Button variant="secondary" className="flex-1" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" className="border border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => setDeleteId(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {showModal ? (
        <Modal title={editing ? `Edit plan #${editing}` : "Create a plan"} onClose={closeModal}>
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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving..." : editing ? "Update plan" : "Create plan"}</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteId ? (
        <Modal title="Delete plan?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">If tenants are on this plan, it will be archived instead of deleted.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}