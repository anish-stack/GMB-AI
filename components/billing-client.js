"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { Card, CardBody, CardHeader, Button, Badge, Table, EmptyRow, Select, Input, Field } from "@/components/ui";
import { LIMIT_LABEL, FEATURE_LABEL, FEATURE_KEYS, isUnlimited } from "@/lib/saas/constants.js";
import { formatDate } from "@/lib/utils";
import { openRazorpay } from "@/lib/hooks/razorpay-checkout";

function money(v, cur = "INR") {
  const n = Number(v || 0);
  return `${cur === "INR" ? "₹" : cur + " "}${n.toLocaleString("en-IN")}`;
}

export function BillingClient({ data, canManage }) {
  const router = useRouter();
  const [cycle, setCycle] = useState(data.subscription?.billing_cycle || "MONTHLY");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function post(url, body) {
    setErr("");
    setMsg("");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  }

  async function changePlan(planId) {
    setBusy(`plan-${planId}`);
    try {
      const json = await post("/api/billing/upgrade", { plan_id: planId, billing_cycle: cycle });
      setMsg(json.message);
      router.refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  async function payInvoice(inv) {
    setBusy(`inv-${inv.id}`);
    setErr("");
    setMsg("");
    try {
      const order = await post(`/api/billing/invoices/${inv.id}/pay`, {});
      const resp = await openRazorpay(order);
      const json = await post(`/api/billing/invoices/${inv.id}/pay`, resp);
      setMsg(json.message);
      router.refresh();
    } catch (e) {
      if (!e.cancelled) setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  async function buyPack(packId) {
    setBusy(`pack-${packId}`);
    try {
      const json = await post("/api/billing/credits", { pack_id: packId });
      setMsg(json.message);
      router.refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  async function cancelPlan() {
    if (!confirm("Cancel at the end of the current period?")) return;
    setBusy("cancel");
    try {
      const json = await post("/api/billing/upgrade", { action: "cancel" });
      setMsg(json.message);
      router.refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      {msg ? <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">{msg}</p> : null}
      {err ? <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{err}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={`${data.plan?.name || "No plan"} - ${data.status}`}
            subtitle={
              data.subscription
                ? `${money(data.subscription.price, data.subscription.currency)} / ${data.subscription.billing_cycle.toLowerCase()} · renews ${formatDate(data.subscription.current_period_end)}`
                : "No active subscription"
            }
            action={
              canManage && data.subscription?.cancel_at_period_end !== 1 && Number(data.subscription?.price) > 0 ? (
                <Button variant="dangerGhost" onClick={cancelPlan} disabled={busy === "cancel"} className="!py-1.5">
                  Cancel plan
                </Button>
              ) : null
            }
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {data.quotas.map((q) => (
              <div key={q.key}>
                <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{LIMIT_LABEL[q.key]}</span>
                  <span>{q.unlimited ? `${q.used} / ∞` : `${q.used} / ${q.limit}`}</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-2 rounded-full ${q.percent >= 100 ? "bg-rose-500" : q.percent >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${q.unlimited ? 6 : q.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="AI credit wallet" subtitle={`About ${data.postCost} credits per generated post`} />
          <CardBody className="space-y-3">
            <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">{data.wallet.balance}</p>
            <div className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <p>Plan credits: {data.wallet.plan_credits} (reset each cycle)</p>
              <p>Purchased credits: {data.wallet.purchased_credits} (never expire)</p>
              <p>Used all-time: {data.wallet.lifetime_used}</p>
            </div>
            <div className="space-y-2 pt-1">
              {data.packs.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{p.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{p.credits} credits · {money(p.price, p.currency)}</p>
                  </div>
                  {canManage ? (
                    <Button variant="secondary" className="!py-1.5" onClick={() => buyPack(p.id)} disabled={busy === `pack-${p.id}`}>
                      {busy === `pack-${p.id}` ? "..." : "Buy"}
                    </Button>
                  ) : null}
                </div>
              ))}
              {!data.packs.length ? <p className="text-xs text-zinc-500">No credit packs on sale.</p> : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Plans"
          subtitle="Switch any time. A new invoice is raised for the new cycle."
          action={
            <Select value={cycle} onChange={(e) => setCycle(e.target.value)} className="!w-40">
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </Select>
          }
        />
        <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.plans.map((p) => {
            const price = cycle === "YEARLY" ? p.price_yearly : p.price_monthly;
            const current = data.plan?.id === p.id;
            return (
              <div
                key={p.id}
                className={`flex flex-col rounded-2xl border p-4 ${current ? "border-[#F53236] ring-1 ring-[#F53236]" : "border-zinc-200 dark:border-zinc-800"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</p>
                  {current ? <Badge tone="emerald">Current</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{p.tagline}</p>
                <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {money(price, p.currency)}
                  <span className="text-sm font-normal text-zinc-500">/{cycle === "YEARLY" ? "yr" : "mo"}</span>
                </p>
                <ul className="mt-3 flex-1 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                  <li>{isUnlimited(p.max_clients) ? "Unlimited" : p.max_clients} clients</li>
                  <li>{isUnlimited(p.max_posts_month) ? "Unlimited" : p.max_posts_month} posts / month</li>
                  <li>{isUnlimited(p.max_team_members) ? "Unlimited" : p.max_team_members} team members</li>
                  <li>{p.ai_credits_month} AI credits / month</li>
                  {FEATURE_KEYS.filter((f) => p[f]).slice(0, 4).map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500" /> {FEATURE_LABEL[f]}
                    </li>
                  ))}
                </ul>
                {canManage ? (
                  <Button
                    className="mt-4 w-full"
                    variant={current ? "secondary" : "primary"}
                    disabled={current || busy === `plan-${p.id}`}
                    onClick={() => changePlan(p.id)}
                  >
                    {current ? "Active" : busy === `plan-${p.id}` ? "Switching..." : "Choose plan"}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Invoices" />
          <Table head={["Invoice", "Type", "Amount", "Status", "Date"]}
            empty={!data.invoices.length ? <EmptyRow colSpan={5}>No invoices yet.</EmptyRow> : null}>
            {data.invoices.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">{i.invoice_no}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">{i.type}</td>
                <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{money(i.total, i.currency)}</td>
                <td className="px-4 py-2">
                  {i.status === "DUE" && data.onlinePayments && canManage ? (
                    <Button className="!px-2.5 !py-1 text-xs" disabled={busy === `inv-${i.id}`} onClick={() => payInvoice(i)}>
                      {busy === `inv-${i.id}` ? "Opening..." : "Pay now"}
                    </Button>
                  ) : (
                    <Badge tone={i.status === "PAID" ? "emerald" : i.status === "DUE" ? "amber" : "slate"}>{i.status}</Badge>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">{formatDate(i.created_at)}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card>
          <CardHeader title="Credit activity" subtitle="Newest first" />
          <Table head={["When", "Reason", "Change", "Balance"]}
            empty={!data.ledger.length ? <EmptyRow colSpan={4}>No credit activity yet.</EmptyRow> : null}>
            {data.ledger.slice(0, 15).map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-xs text-zinc-500">{formatDate(l.created_at, true)}</td>
                <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-300">{l.reason}{l.note ? ` · ${l.note}` : ""}</td>
                <td className={`px-4 py-2 text-sm font-medium ${l.delta < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {l.delta > 0 ? `+${l.delta}` : l.delta}
                </td>
                <td className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300">{l.balance_after}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card>
        <CardHeader title="Features on your plan" />
        <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_KEYS.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              {data.features[f] ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Minus className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
              )}
              <span className={data.features[f] ? "text-zinc-700 dark:text-zinc-200" : "text-zinc-400"}>
                {FEATURE_LABEL[f]}
              </span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
