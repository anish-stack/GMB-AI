"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Layers, Loader2 } from "lucide-react";
import { Button, Alert, Modal } from "@/components/ui";

/**
 * "This Google login manages more listings" -> make each one its OWN client,
 * so posting for another listing never needs switching this client's location.
 */
export function SiblingListings({ clientId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);

  async function call(action, extra = {}) {
    const res = await fetch("/api/gmb/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, action, ...extra }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) throw new Error(j.error || "Request failed");
    return j;
  }
  async function load() {
    setOpen(true);
    setBusy("load");
    setMsg(null);
    try {
      const j = await call("siblings");
      setItems(j.items);
      setPicked(new Set(j.items.filter((i) => !i.imported).map((i) => i.name)));
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }
  async function run() {
    setBusy("import");
    setMsg(null);
    try {
      const j = await call("siblings_import", { names: [...picked] });
      setMsg({ tone: "green", text: `${j.created.length} new client(s) created and connected${j.skipped.length ? `, ${j.skipped.length} skipped` : ""}. Services, keywords and logo import in the background.` });
      const again = await call("siblings");
      setItems(again.items);
      setPicked(new Set());
      router.refresh();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }
  const toggle = (n) => setPicked((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });

  return (
    <>
      <Button variant="secondary" onClick={load}><Layers className="h-3.5 w-3.5" /> Other listings → clients</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Other listings on this Google account" size="lg"
        footer={items?.some((i) => !i.imported) ? <Button onClick={run} disabled={busy === "import" || !picked.size}>{busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create {picked.size} client(s)</Button> : null}>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">Each selected listing becomes its own client - connected, with its own posts, keywords and calendar. This client keeps only its own listing.</p>
        {msg ? <Alert tone={msg.tone} className="mb-3">{msg.text}</Alert> : null}
        {busy === "load" ? <p className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading listings…</p> : items && !items.length ? (
          <p className="text-sm text-zinc-500">This Google account has no other listings.</p>
        ) : (
          <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {(items || []).map((l) => (
              <li key={l.name} className="flex items-center gap-3 px-3 py-2.5">
                {l.imported ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={picked.has(l.name)} onChange={() => toggle(l.name)} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  <p className="truncate text-xs text-zinc-500">{l.address || l.name}</p>
                </div>
                {l.imported ? <span className="text-xs text-emerald-600">already a client</span> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-zinc-400">Tip: for many listings use <Link href="/gmb/import" className="underline">Import all listings from Google</Link>.</p>
      </Modal>
    </>
  );
}
