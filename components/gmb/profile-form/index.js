"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Building2, CalendarDays, Clock3, Loader2, RefreshCw, Save, ShieldAlert, Tags } from "lucide-react";
import { Input, Textarea, Alert } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/hooks/use-api";
import { buildHours, hoursPayload, hoursError, normalizeServices, FIELD_LABELS, SKIP_REASONS } from "./helpers";
import { Section, Label, HoursEditor, SpecialHoursEditor, CategoryPicker, ServicesEditor } from "./sections";

const label = (f) => FIELD_LABELS[f] || f;

export function GmbProfileForm({ clientId, profile }) {
  const router = useRouter();
  const topRef = useRef(null);
  const initial = useRef({
    categories: (profile?.additional_categories || []).map((c) => c.id).join("|"),
    special: JSON.stringify(profile?.special_hours || []),
  });

  const [form, setForm] = useState({
    location_name: profile?.location_name || profile?.business_name || "",
    phone: profile?.phone || "",
    website: profile?.website || "",
    map_url: profile?.map_url || "",
    description: profile?.description || "",
  });
  const [hours, setHours] = useState(() => buildHours(profile?.opening_hours));
  const [special, setSpecial] = useState(() => profile?.special_hours || []);
  const [categories, setCategories] = useState(() => profile?.additional_categories || []);
  const [services, setServices] = useState(() => normalizeServices(profile?.services));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const diag = useApi(`/api/gmb/${clientId}/diagnose`);
  const pending = useMemo(
    () => new Set([...(profile?.pending_fields || []), ...(diag.data?.pendingFields || [])].map((f) => f.split(".")[0])),
    [profile?.pending_fields, diag.data],
  );
  const pendingChanges = diag.data?.pendingChanges ?? profile?.pending_changes ?? [];
  const diffChanges = diag.data?.diffChanges ?? [];
  const lock = {
    title: pending.has("title"),
    phone: pending.has("phoneNumbers"),
    website: pending.has("websiteUri"),
    hours: pending.has("regularHours"),
    special: pending.has("specialHours"),
    services: pending.has("serviceItems"),
    description: pending.has("profile"),
    categories: pending.has("categories"),
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const descHasUrl = /https?:\/\/|www\./i.test(form.description);

  async function submit(e) {
    e.preventDefault();
    const invalid =
      (!lock.title && !form.location_name.trim() && "Business name can't be empty.") ||
      (form.website && !/^https?:\/\//i.test(form.website.trim()) && "Website must start with http:// or https://") ||
      (!lock.hours && hoursError(hours)) ||
      (special.some((s) => !s.date) && "Every special-hours row needs a date.");
    if (invalid) {
      setError(invalid);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const payload = { ...form, opening_hours: hoursPayload(hours), services };
    if (JSON.stringify(special) !== initial.current.special) payload.special_hours = special;
    const catIds = categories.map((c) => c.id);
    if (catIds.join("|") !== initial.current.categories) payload.additional_category_ids = catIds;
    if (lock.title) delete payload.location_name;
    if (lock.phone) delete payload.phone;
    if (lock.website) delete payload.website;
    if (lock.hours) delete payload.opening_hours;
    if (lock.services) delete payload.services;
    if (lock.description) delete payload.description;
    if (lock.special) delete payload.special_hours;
    if (lock.categories) delete payload.additional_category_ids;

    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await apiFetch(`/api/gmb/${clientId}`, { method: "PATCH", body: payload });
      setResult({ changed: data.changed || [], skipped: data.skipped || [] });
      initial.current = { categories: catIds.join("|"), special: JSON.stringify(special) };
      diag.reload();
      router.refresh();
    } catch (err) {
      if (err.status === 409) diag.reload();
      setError(err.status === 429 ? "Google is rate-limiting edits on this listing. Wait a minute and save again." : err.message);
    } finally {
      setBusy(false);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <form ref={topRef} onSubmit={submit} className="mx-auto max-w-5xl scroll-mt-4 space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <Link href={`/gmb/${clientId}`} aria-label="Back" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-zinc-950 dark:text-white">Edit business profile</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Only changed fields are sent to Google - one edit per save.</p>
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {result ? (
        <Alert tone={result.changed.length ? "green" : "blue"} action={<Link href={`/gmb/${clientId}`} className="shrink-0 font-semibold underline">View profile</Link>}>
          {result.changed.length ? <p className="font-semibold">Sent to Google: {result.changed.map(label).join(", ")}</p> : <p className="font-semibold">Saved. Nothing changed on Google.</p>}
          {result.skipped.map((s) => <p key={s.field}>{label(s.field)} skipped - {SKIP_REASONS[s.reason] || s.reason}</p>)}
        </Alert>
      ) : null}

      {diag.error ? (
        <Alert tone="amber" action={<button type="button" onClick={diag.reload} className="inline-flex items-center gap-1 font-semibold"><RefreshCw className="h-3.5 w-3.5" /> Retry</button>}>
          Couldn&apos;t check Google review status: {diag.error}
        </Alert>
      ) : null}
      {!diag.loading && pendingChanges.length ? (
        <Alert tone="amber" action={<button type="button" onClick={diag.reload} className="inline-flex items-center gap-1 font-semibold"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>}>
          <p className="mb-1 font-semibold">Waiting for Google review - these fields are locked until then:</p>
          <ul className="space-y-0.5">
            {pendingChanges.map((p) => <li key={p.field}><b>{label(p.field)}:</b> yours &ldquo;{p.submitted}&rdquo; · live &ldquo;{p.live}&rdquo;</li>)}
          </ul>
        </Alert>
      ) : null}
      {!diag.loading && diffChanges.length ? (
        <Alert tone="blue">
          <p className="mb-1 flex items-center gap-1 font-semibold"><ShieldAlert className="h-3.5 w-3.5" /> Google changed some fields itself</p>
          <p className="mb-1">Accept or reject Google&apos;s value in the Business Profile dashboard, otherwise future edits can get stuck.</p>
          <ul>{diffChanges.map((d) => <li key={d.field}><b>{label(d.field)}:</b> yours &ldquo;{d.yours}&rdquo; → Google &ldquo;{d.google}&rdquo;</li>)}</ul>
        </Alert>
      ) : null}

      <Section icon={Building2} title="Business information" description="Shown on Search and Maps">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label locked={lock.title}>Business name *</Label>
            <Input value={form.location_name} onChange={set("location_name")} disabled={lock.title} maxLength={100} placeholder="Exactly as on your signboard" />
          </div>
          <div>
            <Label locked={lock.phone}>Primary phone</Label>
            <Input type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} disabled={lock.phone} placeholder="+91 98xxxxxxx" />
          </div>
          <div>
            <Label locked={lock.website}>Website</Label>
            <Input type="url" inputMode="url" value={form.website} onChange={set("website")} disabled={lock.website} placeholder="https://" />
          </div>
          <div className="sm:col-span-2">
            <Label hint="Local only - not sent to Google">Maps link</Label>
            <Input value={form.map_url} onChange={set("map_url")} placeholder="https://maps.google.com/..." />
          </div>
          <div className="sm:col-span-2">
            <Label locked={lock.description} right={<span className={form.description.length > 750 ? "text-rose-600" : "text-zinc-400"}>{form.description.length}/750</span>}>
              Description
            </Label>
            <Textarea value={form.description} onChange={set("description")} disabled={lock.description} maxLength={750} rows={5}
              placeholder="What you do, who you serve, where. Mention your main services and area naturally. No links, phone numbers or offers." />
            {descHasUrl ? <p className="mt-1 text-[11px] text-amber-600">Google rejects descriptions containing links - remove the URL.</p> : null}
          </div>
        </div>
      </Section>

      <Section icon={Tags} title="Additional categories" description={`Primary: ${profile?.category || "—"} · up to 9 extra categories widen the searches you appear in`} locked={lock.categories}>
        <CategoryPicker clientId={clientId} value={categories} onChange={setCategories} />
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={Clock3} title="Business hours" description="Regular weekly hours" locked={lock.hours}>
          <HoursEditor hours={hours} setHours={setHours} />
        </Section>
        <Section icon={CalendarDays} title="Special hours" description="Holidays (Diwali, Holi…) and one-off closures" locked={lock.special}>
          <SpecialHoursEditor rows={special} setRows={setSpecial} />
        </Section>
      </div>

      <Section icon={BriefcaseBusiness} title="Services" description="Pick Google's suggested services first - they match more searches" locked={lock.services || profile?.can_modify_services === false}>
        <ServicesEditor clientId={clientId} services={services} setServices={setServices} />
      </Section>

      {/* sticky save bar - always reachable on mobile */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur md:left-64 dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2">
          <button type="button" onClick={() => router.push(`/gmb/${clientId}`)} disabled={busy}
            className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#F53236] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#e81d22] disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
