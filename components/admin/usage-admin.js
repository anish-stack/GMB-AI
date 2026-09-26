"use client";

import { useState } from "react";
import Link from "next/link";
import { Gauge, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardBody, Button, Input, Alert, Skeleton, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";

function Bar({ v, max }) {
  const pct = max ? Math.min(100, Math.round((v / max) * 100)) : 0;
  return <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className={`h-full ${pct >= 100 ? "bg-rose-500" : "bg-[#F53236]"}`} style={{ width: `${pct}%` }} /></div>;
}

export function ClientUsageAdmin() {
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useApi(`/api/admin/client-usage?q=${encodeURIComponent(q)}`);
  const [msg, setMsg] = useState(null);
  async function act(body, ok) {
    try {
      await apiFetch(body.action === "extend" ? "/api/admin/client-usage" : "/api/admin/api-usage", { body });
      setMsg({ tone: "green", text: ok });
      reload();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    }
  }
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"><Gauge className="h-5 w-5" /> Client usage</h1>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client or tenant" className="sm:!w-72" />
      </div>
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      <Card className="overflow-x-auto">
        {loading && !items.length ? <Skeleton className="m-4 h-40" /> : (
          <table className="w-full min-w-[1100px] text-sm">
            <thead><tr className="border-b border-zinc-100 text-left text-xs text-zinc-500 dark:border-zinc-800">
              <th className="px-4 py-2">Client / tenant</th><th>Plan</th><th>Dates</th><th>Weekly</th><th>Total</th><th>Breakdown</th><th>API 30d</th><th>Keys</th><th>Tickets</th><th>Last activity</th><th /></tr></thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="px-4 py-2.5"><p className="font-medium">{c.business_name}</p><Link href={`/admin/tenants/${c.tenant_id}`} className="text-xs text-zinc-500 hover:underline">{c.tenant}</Link></td>
                  <td><Badge tone={c.plan_state === "ACTIVE" ? "emerald" : c.plan_state === "EXPIRED" ? "red" : "amber"}>{c.plan_state}</Badge>{c.plan ? <div className="mt-1 text-xs text-zinc-500">{c.plan.months} mo · {c.plan.per_week}/wk</div> : null}</td>
                  <td className="text-xs text-zinc-500">{c.plan ? <>{c.plan.start}<br />→ {c.plan.end}</> : "-"}</td>
                  <td className="text-xs">{c.week ? <>{c.week.used}/{c.week.limit}<Bar v={c.week.used} max={c.week.limit} /></> : "-"}</td>
                  <td className="text-xs">{c.plan ? <>{c.used}/{c.plan.total} · {c.remaining} left<Bar v={c.used} max={c.plan.total} /></> : "-"}</td>
                  <td className="text-[11px] text-zinc-500">{c.counts ? `pub ${c.counts.published} · sch ${c.counts.scheduled} · pend ${c.counts.pending} · proc ${c.counts.processing}` : "-"}</td>
                  <td className="text-xs">{Number(c.api_requests_30d).toLocaleString("en-IN")}</td>
                  <td className="text-xs">{c.api_keys}</td>
                  <td className="text-xs">{c.open_tickets} open</td>
                  <td className="text-xs text-zinc-500">{c.last_activity ? formatDate(c.last_activity, true) : "-"}</td>
                  <td className="space-y-1 whitespace-nowrap pr-3 text-right">
                    {c.plan ? <Button variant="secondary" className="!py-1 text-xs" onClick={() => act({ action: "extend", client_id: c.id, months: 1 }, "Plan extended by 1 month.")}>+1 month</Button> : null}
                    <Button variant="ghost" className="!py-1 text-xs" onClick={() => act({ action: "reset", tenant_id: c.tenant_id }, "Rate limits reset for tenant.")}><RotateCcw className="h-3 w-3" /> Reset limits</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export function ApiUsageAdmin() {
  const { data, error, loading, reload } = useApi("/api/admin/api-usage");
  const [msg, setMsg] = useState(null);
  async function act(body, ok) {
    try {
      const r = await apiFetch("/api/admin/api-usage", { body });
      setMsg({ tone: "green", text: typeof ok === "function" ? ok(r) : ok });
      reload();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    }
  }
  const total = (data?.byDay || []).reduce((s, d) => s + Number(d.requests), 0);
  const max = Math.max(1, ...(data?.byDay || []).map((d) => Number(d.requests)));
  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">API usage & rate limits</h1>
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      {loading && !data ? <Skeleton className="h-64" /> : data ? (
        <>
          <Card>
            <CardHeader title={`Requests - last 30 days (${total.toLocaleString("en-IN")})`} />
            <CardBody>
              <div className="flex h-28 items-end gap-1">
                {data.byDay.map((d) => <div key={d.day} title={`${d.day}: ${d.requests} req, ${d.errors} err, ${d.throttled} throttled`} className="flex-1 rounded-t bg-[#F53236]/70" style={{ height: `${(Number(d.requests) / max) * 100}%` }} />)}
                {!data.byDay.length ? <p className="text-xs text-zinc-400">No API traffic yet.</p> : null}
              </div>
            </CardBody>
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="By tenant" />
              <CardBody className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {data.byTenant.map((t) => (
                      <tr key={t.tenant_id}>
                        <td className="py-2"><Link href={`/admin/tenants/${t.tenant_id}`} className="font-medium hover:underline">{t.tenant}</Link></td>
                        <td className="text-right text-xs">{Number(t.requests).toLocaleString("en-IN")} req</td>
                        <td className="text-right text-xs text-amber-600">{Number(t.throttled) ? `${t.throttled} throttled` : ""}</td>
                        <td className="text-right"><Button variant="ghost" className="!py-1 text-xs" onClick={() => act({ action: "reset", tenant_id: t.tenant_id }, (r) => `Reset ${r.removed} counter(s) for ${t.tenant}.`)}><RotateCcw className="h-3 w-3" /> Reset</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="By endpoint" />
              <CardBody>
                <table className="w-full text-sm"><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.byEndpoint.map((e) => <tr key={e.endpoint}><td className="py-2 font-mono text-xs">{e.endpoint}</td><td className="text-right text-xs">{e.requests}</td><td className="text-right text-xs text-rose-600">{Number(e.errors) || ""}</td></tr>)}
                </tbody></table>
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title="API keys" subtitle="Current-minute counters show live rate-limit state" />
            <CardBody className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead><tr className="text-left text-xs text-zinc-500"><th className="py-2">Key</th><th>Tenant</th><th>Scopes</th><th>Requests</th><th>Last used</th><th>Limit/min</th><th>Now</th><th /></tr></thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.keys.map((k) => {
                    const now = data.live.find((l) => l.bucket === `key:${k.id}:min`);
                    return (
                      <tr key={k.id}>
                        <td className="py-2"><p className="font-medium">{k.name}</p><p className="font-mono text-[11px] text-zinc-400">{k.key_prefix}</p></td>
                        <td className="text-xs">{k.tenant}</td>
                        <td className="max-w-40 truncate text-[11px]">{k.scopes}</td>
                        <td className="text-xs">{Number(k.request_count).toLocaleString("en-IN")}</td>
                        <td className="text-xs text-zinc-500">{k.last_used_at ? formatDate(k.last_used_at, true) : "never"}</td>
                        <td className="text-xs">
                          <input type="number" min={1} defaultValue={k.rate_limit_per_min || ""} placeholder="default" className="w-20 rounded border border-zinc-200 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                            onBlur={(e) => e.target.value !== String(k.rate_limit_per_min || "") && act({ action: "set_limit", api_key_id: k.id, rate_limit_per_min: e.target.value || null }, "Limit updated.")} />
                        </td>
                        <td className="text-xs">{now ? now.hits : 0}</td>
                        <td className="space-x-1 whitespace-nowrap text-right">
                          {k.revoked ? <Badge tone="red">Revoked</Badge> : (
                            <>
                              <Button variant="ghost" className="!py-1 text-xs" onClick={() => act({ action: "reset", api_key_id: k.id }, "Key counters reset.")}>Reset</Button>
                              <Button variant="ghost" className="!py-1 text-xs" onClick={() => act({ action: k.active ? "disable" : "enable", api_key_id: k.id }, k.active ? "Key disabled." : "Key enabled.")}>{k.active ? "Disable" : "Enable"}</Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
