"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Table, EmptyRow, Badge, Button, Field, Input, Select } from "@/components/ui";

const BLANK = { name: "", credits: 1000, price: 499, currency: "INR", is_active: 1, sort_order: 0 };

export function CreditManager({ wallets, packs, tenants, costs }) {
  const router = useRouter();
  const [pack, setPack] = useState(BLANK);
  const [grant, setGrant] = useState({ tenant_id: tenants[0]?.id || "", credits: 500, bucket: "PURCHASED", note: "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [walletQ, setWalletQ] = useState("");

  const walletRows = wallets.filter((w) => !walletQ || w.tenant_name.toLowerCase().includes(walletQ.toLowerCase()));

  async function savePack(e) {
    e.preventDefault();
    setBusy("pack");
    const res = await fetch("/api/admin/packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pack),
    });
    const json = await res.json();
    setBusy("");
    if (!res.ok) return setErr(json.error);
    setPack(BLANK);
    router.refresh();
  }

  async function removePack(id) {
    if (!confirm("Delete this credit pack?")) return;
    await fetch(`/api/admin/packs/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function doGrant(e) {
    e.preventDefault();
    setBusy("grant");
    setErr("");
    setMsg("");
    const res = await fetch("/api/admin/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(grant),
    });
    const json = await res.json();
    setBusy("");
    if (!res.ok) return setErr(json.error);
    setMsg(`Granted. New balance: ${json.wallet.balance}`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {err ? <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{err}</p> : null}
      {msg ? <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{msg}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Grant credits to a tenant" subtitle="Instant top-up, logged in the credit ledger" />
          <CardBody>
            <form onSubmit={doGrant} className="grid gap-3 sm:grid-cols-2">
              <Field label="Tenant">
                <Select value={grant.tenant_id} onChange={(e) => setGrant({ ...grant, tenant_id: e.target.value })}>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
              <Field label="Credits"><Input type="number" value={grant.credits} onChange={(e) => setGrant({ ...grant, credits: e.target.value })} /></Field>
              <Field label="Bucket">
                <Select value={grant.bucket} onChange={(e) => setGrant({ ...grant, bucket: e.target.value })}>
                  <option value="PURCHASED">Purchased (permanent)</option>
                  <option value="PLAN">Plan (this cycle)</option>
                </Select>
              </Field>
              <Field label="Note"><Input value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy === "grant"}>{busy === "grant" ? "Granting..." : "Grant credits"}</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Credit cost per AI unit" subtitle="Change these under Settings" />
          <CardBody className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {Object.entries(costs).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                <p className="text-xs capitalize text-zinc-500">{k}</p>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{v} cr</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Credit packs on sale" subtitle="Tenants buy these from their billing page" />
        <CardBody className="border-b border-zinc-100 dark:border-zinc-800">
          <form onSubmit={savePack} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Pack name"><Input value={pack.name} onChange={(e) => setPack({ ...pack, name: e.target.value })} required /></Field>
            <Field label="Credits"><Input type="number" value={pack.credits} onChange={(e) => setPack({ ...pack, credits: e.target.value })} /></Field>
            <Field label="Price (₹)"><Input type="number" step="0.01" value={pack.price} onChange={(e) => setPack({ ...pack, price: e.target.value })} /></Field>
            <Field label="Sort order"><Input type="number" value={pack.sort_order} onChange={(e) => setPack({ ...pack, sort_order: e.target.value })} /></Field>
            <div className="flex items-end">
              <Button type="submit" disabled={busy === "pack"}><Plus className="h-3.5 w-3.5" /> Add pack</Button>
            </div>
          </form>
        </CardBody>
        <Table head={["Pack", "Credits", "Price", "Per credit", "Status", ""]}
          empty={!packs.length ? <EmptyRow colSpan={6}>No packs yet.</EmptyRow> : null}>
          {packs.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{p.name}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{p.credits}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">₹{p.price}</td>
              <td className="px-4 py-2 text-xs text-zinc-500">₹{(Number(p.price) / Math.max(1, Number(p.credits))).toFixed(3)}</td>
              <td className="px-4 py-2"><Badge tone={p.is_active ? "emerald" : "slate"}>{p.is_active ? "On sale" : "Hidden"}</Badge></td>
              <td className="px-4 py-2 text-right">
                <Button variant="ghost" className="!py-1 text-rose-600" onClick={() => removePack(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <CardHeader
          title={`Tenant wallets (${walletRows.length} of ${wallets.length})`}
          action={<Input placeholder="Search tenant..." value={walletQ} onChange={(e) => setWalletQ(e.target.value)} className="!w-44 !py-1.5" />}
        />
        <Table head={["Tenant", "Plan credits", "Purchased", "Balance", "Granted all-time", "Used all-time"]}
          empty={!walletRows.length ? <EmptyRow colSpan={6}>No wallets match this search.</EmptyRow> : null}>
          {walletRows.map((w) => (
            <tr key={w.tenant_id}>
              <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{w.tenant_name}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{w.plan_credits}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{w.purchased_credits}</td>
              <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{Number(w.plan_credits) + Number(w.purchased_credits)}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{w.lifetime_granted}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{w.lifetime_used}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
