"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Link2, Loader2, MapPin, Plus, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardBody, Button, Select, Input, Alert, Skeleton, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { PostingPlanFields, emptyPlan } from "@/components/posting/plan-fields";

export function GmbBulkImport({ initialConnection = null }) {
  const router = useRouter();
  const conns = useApi("/api/gmb/connections");
  const list = conns.data?.items || [];
  const [cid, setCid] = useState(initialConnection);
  const active = cid || list[0]?.id || null;
  const locs = useApi(active ? `/api/gmb/connections/${active}/locations` : null);
  const items = useMemo(() => locs.data?.items || [], [locs.data]);
  const [picked, setPicked] = useState(new Set());
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState(emptyPlan);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const visible = items.filter((l) => !q || `${l.title} ${l.address} ${l.category}`.toLowerCase().includes(q.toLowerCase()));
  const importable = visible.filter((l) => !l.client_id);
  const toggle = (n) => setPicked((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });

  async function run() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await apiFetch(`/api/gmb/connections/${active}/import`, { body: { locations: [...picked], plan } });
      setResult(r);
      setPicked(new Set());
      locs.reload();
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Import Google Business Profiles</h1>
          <p className="text-sm text-zinc-500">Every selected listing becomes its own client with its own GMB link - no manual sync or location switching.</p>
        </div>
        <form action="/api/gmb/connect-all" method="GET"><Button type="submit"><Plus className="h-4 w-4" /> Connect a Google account</Button></form>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          {conns.loading && !conns.data ? <Skeleton className="h-10 w-64" /> : list.length ? (
            <>
              <span className="text-sm text-zinc-500">Google account</span>
              <Select value={active || ""} onChange={(e) => { setCid(Number(e.target.value)); setPicked(new Set()); }} className="!w-auto">
                {list.map((c) => <option key={c.id} value={c.id}>{c.google_email} · {c.clients} imported</option>)}
              </Select>
              <Button variant="secondary" onClick={locs.reload} disabled={locs.loading}>{locs.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Rescan</Button>
            </>
          ) : (
            <p className="text-sm text-zinc-500">No Google account connected yet. Click <b>Connect a Google account</b> and sign in with the Google login that manages your clients&apos; listings (owner or manager access).</p>
          )}
        </CardBody>
      </Card>

      {locs.error ? <Alert>{locs.error}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      {result ? (
        <Alert tone="green">
          {result.created.length} client(s) created and linked{result.skipped.length ? `, ${result.skipped.length} skipped` : ""}. Services, keywords, logo and links are being imported in the background.
          {result.created.length ? <> <Link href="/clients" className="font-semibold underline">Open clients</Link></> : null}
        </Alert>
      ) : null}

      {active ? (
        <Card className="overflow-hidden">
          <CardHeader title={`Listings (${items.length})`} subtitle={`${items.filter((l) => l.client_id).length} already imported`} />
          <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, address, category" className="sm:!w-80" />
            <Button variant="secondary" disabled={!importable.length} onClick={() => setPicked(new Set(importable.map((l) => l.name)))}>Select all new ({importable.length})</Button>
            {picked.size ? <Button variant="ghost" onClick={() => setPicked(new Set())}>Clear</Button> : null}
          </div>
          {locs.loading && !locs.data ? <Skeleton className="m-5 h-40" /> : (
            <ul className="max-h-[480px] divide-y divide-zinc-100 overflow-y-auto border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
              {visible.map((l) => (
                <li key={l.name} className="flex items-center gap-3 px-5 py-3">
                  {l.client_id ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : (
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#F53236]" checked={picked.has(l.name)} onChange={() => toggle(l.name)} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{l.title}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-zinc-500"><MapPin className="h-3 w-3 shrink-0" />{l.address || "Service-area business"}{l.category ? ` · ${l.category}` : ""}</p>
                  </div>
                  {!l.verified ? <Badge tone="amber">Not verified</Badge> : null}
                  {l.client_id ? <Link href={`/gmb/${l.client_id}`}><Badge tone="emerald">Imported - open</Badge></Link> : null}
                </li>
              ))}
              {!visible.length ? <li className="px-5 py-6 text-center text-sm text-zinc-400">No listings found.</li> : null}
            </ul>
          )}
        </Card>
      ) : null}

      {picked.size ? (
        <Card>
          <CardHeader title={`Posting plan for the ${picked.size} new client(s)`} subtitle="Applied to every imported client - you can change each one later" />
          <CardBody className="space-y-4">
            <PostingPlanFields value={plan} onChange={setPlan} />
            <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Import {picked.size} listing(s) as clients</Button>
          </CardBody>
        </Card>
      ) : null}

      <p className="flex items-center gap-1 text-xs text-zinc-400"><Link2 className="h-3 w-3" /> Single client? Send the client&apos;s own connect link instead - they&apos;ll choose exactly one listing.</p>
    </div>
  );
}
