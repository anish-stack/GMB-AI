"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Search, Wallet, Package, Users, Coins, X, Gift } from "lucide-react";
import { Card, CardBody, CardHeader, Table, EmptyRow, Badge, Button, Field, Input, Select } from "@/components/ui";

const BLANK_PACK = { name: "", credits: 1000, price: 499, currency: "INR", is_active: 1, sort_order: 0 };

function StatCard({ icon, iconBg, label, value, sub }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] leading-tight text-zinc-500">{label}</p>
        <p className="text-lg font-semibold leading-tight text-zinc-900 dark:text-zinc-100">{value}</p>
        {sub ? <p className="truncate text-[11px] leading-tight text-zinc-400">{sub}</p> : null}
      </div>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl bg-white shadow-xl dark:bg-zinc-900`}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            {subtitle ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

const TABS = [
  { id: "wallets", label: "Tenant Wallets" },
  { id: "packs", label: "Credit Packs" },
];

export function CreditManager({ wallets, packs, tenants, costs }) {
  const router = useRouter();
  const [tab, setTab] = useState("wallets");

  const [pack, setPack] = useState(BLANK_PACK);
  const [grant, setGrant] = useState({ tenant_id: tenants[0]?.id || "", credits: 500, bucket: "PURCHASED", note: "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [walletQ, setWalletQ] = useState("");

  const [showGrant, setShowGrant] = useState(false);
  const [showPackForm, setShowPackForm] = useState(false);
  const [deletePackId, setDeletePackId] = useState(null);

  const walletRows = wallets.filter((w) => !walletQ || w.tenant_name.toLowerCase().includes(walletQ.toLowerCase()));

  const totalBalance = wallets.reduce((s, w) => s + Number(w.plan_credits) + Number(w.purchased_credits), 0);
  const activePacks = packs.filter((p) => p.is_active).length;
  const totalUsed = wallets.reduce((s, w) => s + Number(w.lifetime_used || 0), 0);

  function openGrant() {
    setErr("");
    setMsg("");
    setGrant({ tenant_id: tenants[0]?.id || "", credits: 500, bucket: "PURCHASED", note: "" });
    setShowGrant(true);
  }

  function openPackForm() {
    setErr("");
    setPack(BLANK_PACK);
    setShowPackForm(true);
  }

  async function savePack(e) {
    e.preventDefault();
    setBusy("pack");
    setErr("");
    const res = await fetch("/api/admin/packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pack),
    });
    const json = await res.json();
    setBusy("");
    if (!res.ok) return setErr(json.error);
    setPack(BLANK_PACK);
    setShowPackForm(false);
    router.refresh();
  }

  async function confirmRemovePack() {
    await fetch(`/api/admin/packs/${deletePackId}`, { method: "DELETE" });
    setDeletePackId(null);
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
    setShowGrant(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Credits</h1>
          <p className="text-xs text-zinc-500">Manage AI credit wallets, grants, and purchasable packs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-9" onClick={openGrant}>
            <Gift className="h-4 w-4" /> Grant Credits
          </Button>
          <Button className="h-9" onClick={openPackForm}>
            <Plus className="h-4 w-4" /> New Pack
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Wallet className="h-4.5 w-4.5 text-blue-600" />} iconBg="bg-blue-50" label="Total Balance" value={totalBalance.toLocaleString("en-IN")} sub="Across all wallets" />
        <StatCard icon={<Package className="h-4.5 w-4.5 text-violet-600" />} iconBg="bg-violet-50" label="Active Packs" value={`${activePacks}/${packs.length}`} sub="On sale" />
        <StatCard icon={<Users className="h-4.5 w-4.5 text-emerald-600" />} iconBg="bg-emerald-50" label="Tenant Wallets" value={wallets.length} sub="Total tenants" />
        <StatCard icon={<Coins className="h-4.5 w-4.5 text-amber-600" />} iconBg="bg-amber-50" label="Used All-Time" value={totalUsed.toLocaleString("en-IN")} sub="Credits consumed" />
      </div>

      {msg ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{msg}</p> : null}

      <Card>
        <CardHeader title="Credit cost per AI unit" subtitle="Change these under Settings" />
        <CardBody className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(costs).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60">
              <p className="text-[11px] capitalize text-zinc-500">{k}</p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{v} cr</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-[#F53236] text-zinc-900 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t.label}
            {t.id === "wallets" ? ` (${wallets.length})` : ` (${packs.length})`}
          </button>
        ))}
      </div>

      {tab === "wallets" ? (
        <Card>
          <CardHeader
            title={`Tenant wallets (${walletRows.length} of ${wallets.length})`}
            action={
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Search tenant..."
                  value={walletQ}
                  onChange={(e) => setWalletQ(e.target.value)}
                  className="!w-48 !py-1.5 !pl-8"
                />
              </div>
            }
          />
          <Table
            head={["Tenant", "Plan credits", "Purchased", "Balance", "Granted all-time", "Used all-time"]}
            empty={!walletRows.length ? <EmptyRow colSpan={6}>No wallets match this search.</EmptyRow> : null}
          >
            {walletRows.map((w) => (
              <tr key={w.tenant_id}>
                <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{w.tenant_name}</td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{w.plan_credits}</td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{w.purchased_credits}</td>
                <td className="px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-100">{Number(w.plan_credits) + Number(w.purchased_credits)}</td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{w.lifetime_granted}</td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{w.lifetime_used}</td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Credit packs on sale" subtitle="Tenants buy these from their billing page" />
          <Table
            head={["Pack", "Credits", "Price", "Per credit", "Status", ""]}
            empty={!packs.length ? <EmptyRow colSpan={6}>No packs yet. Click &quot;New Pack&quot; to add one.</EmptyRow> : null}
          >
            {packs.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">{p.name}</td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{p.credits}</td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">₹{p.price}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">₹{(Number(p.price) / Math.max(1, Number(p.credits))).toFixed(3)}</td>
                <td className="px-4 py-2"><Badge tone={p.is_active ? "emerald" : "slate"}>{p.is_active ? "On sale" : "Hidden"}</Badge></td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" className="!py-1 text-rose-600" onClick={() => setDeletePackId(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {showGrant ? (
        <Modal title="Grant credits to a tenant" subtitle="Instant top-up, logged in the credit ledger" onClose={() => setShowGrant(false)}>
          {err ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p> : null}
          <form onSubmit={doGrant} className="grid gap-2.5 sm:grid-cols-2">
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
            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 sm:col-span-2 dark:border-zinc-800">
              <Button type="button" variant="secondary" onClick={() => setShowGrant(false)}>Cancel</Button>
              <Button type="submit" disabled={busy === "grant"}>{busy === "grant" ? "Granting..." : "Grant credits"}</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {showPackForm ? (
        <Modal title="New credit pack" subtitle="Tenants buy these from their billing page" onClose={() => setShowPackForm(false)}>
          {err ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p> : null}
          <form onSubmit={savePack} className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Pack name"><Input value={pack.name} onChange={(e) => setPack({ ...pack, name: e.target.value })} required /></Field>
            <Field label="Credits"><Input type="number" value={pack.credits} onChange={(e) => setPack({ ...pack, credits: e.target.value })} /></Field>
            <Field label="Price (₹)"><Input type="number" step="0.01" value={pack.price} onChange={(e) => setPack({ ...pack, price: e.target.value })} /></Field>
            <Field label="Sort order"><Input type="number" value={pack.sort_order} onChange={(e) => setPack({ ...pack, sort_order: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 sm:col-span-2 dark:border-zinc-800">
              <Button type="button" variant="secondary" onClick={() => setShowPackForm(false)}>Cancel</Button>
              <Button type="submit" disabled={busy === "pack"}>{busy === "pack" ? "Adding..." : "Add pack"}</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deletePackId ? (
        <Modal title="Delete pack?" onClose={() => setDeletePackId(null)}>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Tenants will no longer be able to purchase this pack.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletePackId(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmRemovePack}>Delete</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}