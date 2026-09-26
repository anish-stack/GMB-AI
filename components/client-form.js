"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { PostingPlanFields, emptyPlan } from "@/components/posting/plan-fields";
import { POST_TYPES, TONES, FREQUENCIES } from "@/lib/constants";

export function ClientForm({ client, employees = [] }) {
  const router = useRouter();
  const editing = Boolean(client);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    business_name: client?.business_name || "",
    business_category: client?.business_category || "",
    description: client?.description || "",
    phone: client?.phone || "",
    website: client?.website || "",
    address: client?.address || "",
    city: client?.city || "",
    state: client?.state || "",
    country: client?.country || "India",
    preferred_language: client?.preferred_language || "English",
    content_tone: client?.content_tone || "Professional",
    posting_frequency: client?.posting_frequency || "WEEKLY",
    gmb_location_id: client?.gmb_location_id || "",
    assigned_employee_id: client?.assigned_employee_id || "",
    services: (client?.services || []).map((s) => s.name).join("\n"),
    target_locations: (client?.locations || []).map((l) => l.name).join("\n"),
    target_keywords: (client?.keywords || []).filter((k) => k.source === "CLIENT").map((k) => k.keyword).join("\n"),
    prohibited_claims: (client?.prohibited_claims || []).join("\n"),
  });

  const [plan, setPlan] = useState(emptyPlan);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const url = editing ? `/api/clients/${client.id}` : "/api/clients";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? form : { ...form, posting_plan: plan }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Save failed");
    router.push(editing ? `/clients/${client.id}` : `/clients/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <CardHeader title="Business information" subtitle="Only these verified details are given to the AI agents" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Business name"><Input value={form.business_name} onChange={set("business_name")} required /></Field>
          <Field label="Category"><Input value={form.business_category} onChange={set("business_category")} placeholder="Dental Clinic" required /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Website"><Input value={form.website} onChange={set("website")} /></Field>
          <Field label="Address"><Input value={form.address} onChange={set("address")} /></Field>
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="State"><Input value={form.state} onChange={set("state")} /></Field>
          <Field label="GMB location id" hint="Mock id is generated if left empty">
            <Input value={form.gmb_location_id} onChange={set("gmb_location_id")} />
          </Field>
          <Field label="Assigned employee">
            <Select value={form.assigned_employee_id} onChange={set("assigned_employee_id")}>
              <option value="">Unassigned</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea value={form.description} onChange={set("description")} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Services, locations and keywords" subtitle="One per line" />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <Field label="Services"><Textarea className="min-h-32" value={form.services} onChange={set("services")} /></Field>
          <Field label="Target locations"><Textarea className="min-h-32" value={form.target_locations} onChange={set("target_locations")} /></Field>
          <Field label="Target keywords"><Textarea className="min-h-32" value={form.target_keywords} onChange={set("target_keywords")} /></Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Content rules" subtitle="Tone, language and phrases the AI must never use" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Tone">
            <Select value={form.content_tone} onChange={set("content_tone")}>
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Language"><Input value={form.preferred_language} onChange={set("preferred_language")} /></Field>
          <Field label="Posting frequency">
            <Select value={form.posting_frequency} onChange={set("posting_frequency")}>
              {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
            </Select>
          </Field>
          <Field label="Prohibited claims" hint="One per line">
            <Textarea value={form.prohibited_claims} onChange={set("prohibited_claims")} />
          </Field>
        </CardBody>
      </Card>

      {!editing ? (
        <Card>
          <CardHeader title="Posting plan" subtitle="What the client purchased - scheduling and AI generation are capped to this." />
          <CardBody>
            <PostingPlanFields value={plan} onChange={setPlan} />
          </CardBody>
        </Card>
      ) : null}

      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Create client"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Post types available in the calendar: {POST_TYPES.join(", ")}.</p>
    </form>
  );
}
