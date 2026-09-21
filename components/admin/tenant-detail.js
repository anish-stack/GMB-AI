"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Table, EmptyRow, Badge, Button, Field, Input, Select } from "@/components/ui";
import { LIMIT_KEYS, FEATURE_KEYS, LIMIT_LABEL, FEATURE_LABEL, ROLE_LABEL } from "@/lib/saas/constants.js";
import { formatDate } from "@/lib/utils";

export function TenantDetail({ tenant, ent, plans }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [planId, setPlanId] = useState(tenant.subscription?.plan_id || plans[0]?.id);
  const [cycle, setCycle] = useState(tenant.subscription?.billing_cycle || "MONTHLY");
  const [credits, setCredits] = useState(500);
  const [bucket, setBucket] = useState("PURCHASED");
  const [days, setDays] = useState(30);
  const [overrides, setOverrides] = useState(() => {
    try {
      return JSON.parse(tenant.subscription?.overrides || "{}") || {};
    } catch {
      return {};
    }
  });
  const [profile, setProfile] = useState({
    name: tenant.name || "",
    company_email: tenant.company_email || "",
    phone: tenant.phone || "",
    city: tenant.city || "",
    gst_number: tenant.gst_number || "",
    notes: tenant.notes || "",
  });

  async function call(body, tag) {
    setBusy(tag);
    setErr("");
    setMsg("");
    const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy("");
    if (!res.ok) return setErr(json.error || "Action failed");
    setMsg("Done");
    router.refresh();
  }

  function setOverride(key, value) {
    setOverrides((o) => {
      const next = { ...o };
      if (value === "" || value === null) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {msg ? <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{msg}</p> : null}
      {err ? <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{err}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={tenant.name}
            subtitle={`${tenant.owner_name || "-"} · ${tenant.owner_email || "-"} · joined ${formatDate(tenant.created_at)}`}
            action={
              <div className="flex gap-2">
                {tenant.status === "ACTIVE" ? (
                  <Button
                    variant="dangerGhost"
                    className="!py-1.5"
                    disabled={busy === "suspend"}
                    onClick={() => {
                      const reason = prompt("Reason for suspension?") || "Suspended by admin";
                      call({ action: "suspend", reason }, "suspend");
                    }}
                  >
                    Suspend
                  </Button>
                ) : (
                  <Button variant="success" className="!py-1.5" disabled={busy === "activate"} onClick={() => call({ action: "activate" }, "activate")}>
                    Reactivate
                  </Button>
                )}
              </div>
            }
          />
          <CardBody className="grid gap-3 sm:grid-cols-4 text-sm">
            <Metric label="Clients" value={tenant.counts?.clients || 0} />
            <Metric label="Posts generated" value={tenant.counts?.tasks || 0} />
            <Metric label="Published" value={tenant.counts?.posts || 0} />
            <Metric label="AI calls" value={tenant.counts?.ai_calls || 0} />
            <Metric label="Plan credits" value={tenant.wallet?.plan_credits || 0} />
            <Metric label="Purchased credits" value={tenant.wallet?.purchased_credits || 0} />
            <Metric label="Credits used" value={tenant.wallet?.lifetime_used || 0} />
            <Metric label="AI cost tracked" value={tenant.counts?.ai_cost ?? "-"} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Subscription" subtitle={tenant.subscription ? `${tenant.subscription.plan_name} · ${tenant.subscription.status}` : "None"} />
          <CardBody className="space-y-3">
            <Field label="Plan">
              <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} - ₹{p.price_monthly}/mo</option>)}
              </Select>
            </Field>
            <Field label="Billing cycle">
              <Select value={cycle} onChange={(e) => setCycle(e.target.value)}>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </Select>
            </Field>
            <Button
              className="w-full"
              disabled={busy === "plan"}
              onClick={() => call({ action: "change-plan", plan_id: planId, billing_cycle: cycle }, "plan")}
            >
              {busy === "plan" ? "Applying..." : "Apply plan"}
            </Button>

            <div className="flex gap-2">
              <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} className="!w-24" />
              <Button variant="secondary" className="flex-1" disabled={busy === "extend"} onClick={() => call({ action: "extend", days }, "extend")}>
                Extend days
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={busy === "renew"} onClick={() => call({ action: "renew" }, "renew")}>
                Renew cycle
              </Button>
              <Button variant="dangerGhost" className="flex-1" disabled={busy === "cancel"} onClick={() => call({ action: "cancel", immediate: true }, "cancel")}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Current period: {tenant.subscription ? `${formatDate(tenant.subscription.current_period_start)} → ${formatDate(tenant.subscription.current_period_end)}` : "-"}
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Grant AI credits" subtitle="Purchased credits never expire. Plan credits reset each cycle." />
          <CardBody className="flex flex-wrap items-end gap-3">
            <Field label="Credits" className="w-32"><Input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} /></Field>
            <Field label="Bucket" className="w-44">
              <Select value={bucket} onChange={(e) => setBucket(e.target.value)}>
                <option value="PURCHASED">Purchased (permanent)</option>
                <option value="PLAN">Plan (this cycle)</option>
              </Select>
            </Field>
            <Button disabled={busy === "credits"} onClick={() => call({ action: "grant-credits", credits, bucket }, "credits")}>
              {busy === "credits" ? "Granting..." : "Grant credits"}
            </Button>
            <p className="w-full text-xs text-zinc-500">Wallet balance now: {(tenant.wallet?.plan_credits || 0) + (tenant.wallet?.purchased_credits || 0)}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tenant profile" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Company"><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label="Billing email"><Input value={profile.company_email} onChange={(e) => setProfile({ ...profile, company_email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
            <Field label="City"><Input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} /></Field>
            <Field label="GST number"><Input value={profile.gst_number} onChange={(e) => setProfile({ ...profile, gst_number: e.target.value })} /></Field>
            <Field label="Internal notes"><Input value={profile.notes} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} /></Field>
            <div className="sm:col-span-2">
              <Button variant="secondary" disabled={busy === "profile"} onClick={() => call(profile, "profile")}>Save profile</Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Per-tenant overrides"
          subtitle="Leave blank to inherit the plan. Anything set here beats the plan value."
          action={
            <Button disabled={busy === "overrides"} onClick={() => call({ action: "overrides", overrides }, "overrides")}>
              {busy === "overrides" ? "Saving..." : "Save overrides"}
            </Button>
          }
        />
        <CardBody className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {LIMIT_KEYS.map((k) => (
              <Field key={k} label={LIMIT_LABEL[k]} hint={`Plan: ${ent.limits[k] < 0 ? "unlimited" : ent.limits[k]}`}>
                <Input
                  type="number"
                  placeholder="inherit"
                  value={overrides[k] ?? ""}
                  onChange={(e) => setOverride(k, e.target.value === "" ? "" : Number(e.target.value))}
                />
              </Field>
            ))}
          </div>
          <div className="space-y-2">
            {FEATURE_KEYS.map((k) => (
              <label key={k} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/60">
                <span className="text-zinc-700 dark:text-zinc-200">{FEATURE_LABEL[k]}</span>
                <Select
                  className="!w-32 !py-1 text-xs"
                  value={overrides[k] === undefined ? "" : String(overrides[k])}
                  onChange={(e) => setOverride(k, e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">Plan ({ent.features[k] ? "on" : "off"})</option>
                  <option value="1">Force on</option>
                  <option value="0">Force off</option>
                </Select>
              </label>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Users" />
          <Table head={["Name", "Email", "Role", "Last login"]} empty={!tenant.users.length ? <EmptyRow colSpan={4}>None</EmptyRow> : null}>
            {tenant.users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 text-zinc-800 dark:text-zinc-100">{u.name}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">{u.email}</td>
                <td className="px-4 py-2"><Badge tone={u.role === "OWNER" ? "indigo" : "slate"}>{ROLE_LABEL[u.role]}</Badge></td>
                <td className="px-4 py-2 text-xs text-zinc-500">{u.last_login_at ? formatDate(u.last_login_at, true) : "never"}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card>
          <CardHeader title="Invoices" />
          <Table head={["Invoice", "Total", "Status", "Date"]} empty={!tenant.invoices.length ? <EmptyRow colSpan={4}>None</EmptyRow> : null}>
            {tenant.invoices.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2 font-mono text-xs">{i.invoice_no}</td>
                <td className="px-4 py-2">₹{i.total}</td>
                <td className="px-4 py-2"><Badge tone={i.status === "PAID" ? "emerald" : "amber"}>{i.status}</Badge></td>
                <td className="px-4 py-2 text-xs text-zinc-500">{formatDate(i.created_at)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Credit ledger" />
          <Table head={["When", "Reason", "Change", "Balance"]} empty={!tenant.ledger.length ? <EmptyRow colSpan={4}>None</EmptyRow> : null}>
            {tenant.ledger.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-xs text-zinc-500">{formatDate(l.created_at, true)}</td>
                <td className="px-4 py-2 text-xs">{l.reason}</td>
                <td className={`px-4 py-2 text-sm font-medium ${l.delta < 0 ? "text-rose-600" : "text-emerald-600"}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                <td className="px-4 py-2 text-sm">{l.balance_after}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card>
          <CardHeader title="Subscription history" />
          <Table head={["When", "Event", "From", "To", "By"]} empty={!tenant.events.length ? <EmptyRow colSpan={5}>None</EmptyRow> : null}>
            {tenant.events.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 text-xs text-zinc-500">{formatDate(e.created_at, true)}</td>
                <td className="px-4 py-2 text-xs font-medium">{e.event}</td>
                <td className="px-4 py-2 text-xs">{e.from_plan || "-"}</td>
                <td className="px-4 py-2 text-xs">{e.to_plan || "-"}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">{e.actor}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}
