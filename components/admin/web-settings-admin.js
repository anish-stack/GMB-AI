"use client";

import { useState } from "react";
import { Card, CardHeader, CardBody, Button, Field, Input, Textarea, Select, Alert, Skeleton } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

export function WebSettingsAdmin() {
  const { data, error, loading, mutate } = useApi("/api/admin/web-settings");
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (loading && !data) return <Skeleton className="h-96" />;
  if (error) return <Alert>{error}</Alert>;
  const s = { ...(data?.settings || {}), ...draft };
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.type === "checkbox" ? (e.target.checked ? 1 : 0) : e.target.value }));
  const social = s.social_links || {};

  async function save(extra = {}) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiFetch("/api/admin/web-settings", { method: "PATCH", body: { ...draft, ...extra } });
      mutate(r);
      setDraft({});
      setMsg({ tone: "green", text: "Settings saved." });
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy(false);
    }
  }
  async function upload(kind, file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch("/api/admin/web-settings", { method: "POST", body: fd });
    const j = await res.json();
    if (!res.ok) return setMsg({ tone: "red", text: j.error });
    mutate((d) => ({ ...d, settings: j.settings }));
  }

  const maint = Number(s.maintenance_enabled) === 1;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Web & app settings</h1>
          <p className="text-sm text-zinc-500">Branding, SEO, contact, legal pages, maintenance and API defaults.</p>
        </div>
        <Button onClick={() => save()} disabled={busy || !Object.keys(draft).length}>{busy ? "Saving…" : "Save changes"}</Button>
      </div>
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

      <Card className={maint ? "ring-2 ring-amber-400" : ""}>
        <CardHeader title="Maintenance mode" subtitle="Locks every tenant panel and tenant API. Super admins and allow-listed users/IPs keep working." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-4 sm:col-span-2 dark:bg-zinc-800/60">
            <div>
              <p className="font-semibold">{maint ? "Maintenance is ON" : "Maintenance is OFF"}</p>
              <p className="text-xs text-zinc-500">Changes apply within 15 seconds.</p>
            </div>
            <Button variant={maint ? "secondary" : "primary"} disabled={busy} onClick={() => window.confirm(maint ? "Turn maintenance OFF?" : "Turn maintenance ON? All tenants will be locked out.") && save({ maintenance_enabled: maint ? 0 : 1 })}>
              {maint ? "Turn off" : "Turn on"}
            </Button>
          </div>
          <Field label="Title"><Input value={s.maintenance_title || ""} onChange={set("maintenance_title")} /></Field>
          <Field label="Expected completion"><Input value={s.maintenance_eta || ""} onChange={set("maintenance_eta")} placeholder="Back by 11:00 PM IST" /></Field>
          <Field label="Message" className="sm:col-span-2"><Textarea value={s.maintenance_message || ""} onChange={set("maintenance_message")} rows={3} /></Field>
          <Field label="Allowed IPs" hint="Comma separated"><Input value={s.maintenance_allowed_ips || ""} onChange={set("maintenance_allowed_ips")} /></Field>
          <Field label="Allowed user emails" hint="Comma separated"><Input value={s.maintenance_allowed_emails || ""} onChange={set("maintenance_allowed_emails")} /></Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Branding" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Website / app name"><Input value={s.platform_name || ""} onChange={set("platform_name")} /></Field>
          <Field label="Tagline"><Input value={s.site_tagline || ""} onChange={set("site_tagline")} /></Field>
          <Field label="Brand color"><Input type="color" value={s.brand_color || "#F53236"} onChange={set("brand_color")} className="h-10" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Logo">
              {s.logo_url ? <span role="img" aria-label="Logo" className="mb-1 block h-10 w-24 rounded bg-contain bg-left bg-no-repeat" style={{ backgroundImage: `url(${s.logo_url})` }} /> : null}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload("logo", e.target.files?.[0])} className="text-xs" />
            </Field>
            <Field label="Favicon">
              {s.favicon_url ? <span role="img" aria-label="Favicon" className="mb-1 block h-8 w-8 rounded bg-contain bg-no-repeat" style={{ backgroundImage: `url(${s.favicon_url})` }} /> : null}
              <input type="file" accept="image/png,image/x-icon,image/webp" onChange={(e) => upload("favicon", e.target.files?.[0])} className="text-xs" />
            </Field>
          </div>
          <Field label="Footer text" className="sm:col-span-2"><Input value={s.footer_text || ""} onChange={set("footer_text")} /></Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contact & social" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Support email"><Input type="email" value={s.support_email || ""} onChange={set("support_email")} /></Field>
          <Field label="Support phone"><Input value={s.support_phone || ""} onChange={set("support_phone")} /></Field>
          <Field label="Address"><Input value={s.contact_address || ""} onChange={set("contact_address")} /></Field>
          {["facebook", "instagram", "linkedin", "x", "youtube"].map((k) => (
            <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
              <Input value={social[k] || ""} placeholder="https://" onChange={(e) => setDraft((d) => ({ ...d, social_links: { ...social, [k]: e.target.value } }))} />
            </Field>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Default SEO" />
        <CardBody className="grid gap-4">
          <Field label="SEO title"><Input value={s.seo_title || ""} onChange={set("seo_title")} maxLength={70} /></Field>
          <Field label="SEO description"><Textarea value={s.seo_description || ""} onChange={set("seo_description")} rows={2} maxLength={320} /></Field>
          <Field label="Keywords"><Input value={s.seo_keywords || ""} onChange={set("seo_keywords")} /></Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Application" subtitle="Legal pages are edited under CMS pages." />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Public signup"><Select value={String(s.allow_signup)} onChange={set("allow_signup")}><option value="1">Enabled</option><option value="0">Disabled</option></Select></Field>
          <Field label="Posting plan required per client"><Select value={String(s.posting_plan_required)} onChange={set("posting_plan_required")}><option value="1">Yes (strict)</option><option value="0">No</option></Select></Field>
          <Field label="Disable right-click in client panel"><Select value={String(s.app_disable_right_click)} onChange={set("app_disable_right_click")}><option value="1">Yes</option><option value="0">No</option></Select></Field>
          <Field label="Public API"><Select value={String(s.api_enabled)} onChange={set("api_enabled")}><option value="1">Enabled</option><option value="0">Disabled</option></Select></Field>
          <Field label="Default rate / key / min"><Input type="number" min={1} value={s.api_default_rate_per_min} onChange={set("api_default_rate_per_min")} /></Field>
          <Field label="Rate / tenant / min"><Input type="number" min={1} value={s.api_tenant_rate_per_min} onChange={set("api_tenant_rate_per_min")} /></Field>
        </CardBody>
      </Card>
    </div>
  );
}
