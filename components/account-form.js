"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Button, Field, Input } from "@/components/ui";

export function AccountForm({ user, tenant, canEditWorkspace }) {
  const router = useRouter();
  const [profile, setProfile] = useState({ name: user.name, phone: "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [ws, setWs] = useState({
    name: tenant?.name || "",
    company_email: tenant?.company_email || "",
    phone: tenant?.phone || "",
    website: tenant?.website || "",
    city: tenant?.city || "",
    gst_number: tenant?.gst_number || "",
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  async function send(body, tag) {
    setBusy(tag);
    setErr("");
    setMsg("");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy("");
    if (!res.ok) return setErr(json.error);
    setMsg(json.message || "Saved");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {msg ? <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{msg}</p> : null}
      {err ? <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{err}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your profile" subtitle={user.email} />
          <CardBody className="space-y-3">
            <Field label="Name"><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label="Phone"><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
            <Button disabled={busy === "profile"} onClick={() => send({ ...profile }, "profile")}>Save profile</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Change password" />
          <CardBody className="space-y-3">
            <Field label="Current password">
              <Input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
            </Field>
            <Field label="New password" hint="At least 6 characters">
              <Input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
            </Field>
            <Button
              variant="secondary"
              disabled={busy === "pw" || pw.new_password.length < 6}
              onClick={() => send({ action: "password", ...pw }, "pw")}
            >
              Update password
            </Button>
          </CardBody>
        </Card>
      </div>

      {canEditWorkspace ? (
        <Card>
          <CardHeader title="Workspace" subtitle="Used on invoices and in the sidebar" />
          <CardBody className="grid gap-3 sm:grid-cols-3">
            <Field label="Company name"><Input value={ws.name} onChange={(e) => setWs({ ...ws, name: e.target.value })} /></Field>
            <Field label="Billing email"><Input value={ws.company_email} onChange={(e) => setWs({ ...ws, company_email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={ws.phone} onChange={(e) => setWs({ ...ws, phone: e.target.value })} /></Field>
            <Field label="Website"><Input value={ws.website} onChange={(e) => setWs({ ...ws, website: e.target.value })} /></Field>
            <Field label="City"><Input value={ws.city} onChange={(e) => setWs({ ...ws, city: e.target.value })} /></Field>
            <Field label="GST number"><Input value={ws.gst_number} onChange={(e) => setWs({ ...ws, gst_number: e.target.value })} /></Field>
            <div className="sm:col-span-3">
              <Button disabled={busy === "ws"} onClick={() => send({ action: "workspace", ...ws }, "ws")}>Save workspace</Button>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
