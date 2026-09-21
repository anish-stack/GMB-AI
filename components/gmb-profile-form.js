"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Field, Input, Textarea } from "@/components/ui";

export function GmbProfileForm({ clientId, profile }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    location_name: profile?.location_name || "",
    category: profile?.category || "",
    address: profile?.address || "",
    phone: profile?.phone || "",
    website: profile?.website || "",
    map_url: profile?.map_url || "",
    opening_hours: Object.entries(profile?.opening_hours || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const opening_hours = {};
    for (const line of form.opening_hours.split("\n")) {
      const [k, ...rest] = line.split(":");
      if (k && rest.length) opening_hours[k.trim().toLowerCase().replaceAll(" ", "_")] = rest.join(":").trim();
    }
    const res = await fetch(`/api/gmb/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, opening_hours }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Save failed");
    router.push(`/gmb/${clientId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <CardHeader title="Edit GMB profile" subtitle="Updates the listing details used across the app" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Location name" className="sm:col-span-2"><Input value={form.location_name} onChange={set("location_name")} required /></Field>
          <Field label="Category"><Input value={form.category} onChange={set("category")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Website"><Input value={form.website} onChange={set("website")} /></Field>
          <Field label="Map URL"><Input value={form.map_url} onChange={set("map_url")} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={set("address")} /></Field>
          <Field label="Opening hours" hint="One per line, e.g. mon_sat: 10:00-19:00" className="sm:col-span-2">
            <Textarea className="min-h-24" value={form.opening_hours} onChange={set("opening_hours")} />
          </Field>
        </CardBody>
      </Card>

      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save changes"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
