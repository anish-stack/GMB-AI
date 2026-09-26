"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, EyeOff, Inbox, Loader2, RefreshCw, Send, Sparkles, Star, Wand2 } from "lucide-react";
import { Card, Button, Input, Select, Textarea, Alert, Skeleton, EmptyState, PanelHeader, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";

const TONES = ["professional", "friendly", "short", "apologetic", "grateful"];

function Stars({ n }) {
  return (
    <span className="inline-flex" aria-label={`${n} stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-700"}`} />)}
    </span>
  );
}

function Row({ r, onChange }) {
  const [text, setText] = useState(r.ai_draft || "");
  const [tone, setTone] = useState(r.ai_draft_tone || (r.rating <= 2 ? "apologetic" : "professional"));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const act = async (kind, body) => {
    setBusy(kind);
    setErr("");
    try {
      const res = await apiFetch(`/api/reviews/inbox/${r.id}`, { body });
      if (kind === "draft") setText(res.draft);
      else onChange(res.item);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };
  const urgent = r.status === "UNREPLIED" && r.rating && r.rating <= 2;
  return (
    <li className={`rounded-2xl border p-4 ${urgent ? "border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/10" : "border-zinc-200 dark:border-zinc-800"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {r.author} <span className="font-normal text-zinc-400">on</span> <Link href={`/gmb/${r.client_id}?tab=reviews`} className="hover:underline">{r.business_name}</Link>
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500"><Stars n={r.rating || 0} /> {formatDate(r.review_created_at, true)} {r.source === "PUBSUB" ? <Badge tone="blue">real-time</Badge> : null}</p>
        </div>
        <Badge tone={r.status === "REPLIED" ? "emerald" : r.status === "IGNORED" ? "slate" : urgent ? "red" : "amber"}>{urgent ? "Urgent" : r.status.toLowerCase()}</Badge>
      </div>
      <p className={`mt-2 whitespace-pre-line text-sm leading-6 ${r.comment ? "text-zinc-700 dark:text-zinc-300" : "italic text-zinc-400"}`}>{r.comment || "Rating only - no text."}</p>

      {r.status === "REPLIED" ? (
        <div className="mt-3 rounded-xl bg-sky-50 p-3 text-sm dark:bg-sky-950/20">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-sky-800 dark:text-sky-300"><CheckCircle2 className="h-3.5 w-3.5" /> Replied {r.replied_at ? formatDate(r.replied_at, true) : ""}{r.replied_by ? ` by ${r.replied_by}` : ""}</p>
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{r.reply_comment}</p>
        </div>
      ) : r.status === "IGNORED" ? (
        <Button variant="ghost" className="mt-2 text-xs" onClick={() => act("unignore", { action: "unignore" })}>Move back to inbox</Button>
      ) : (
        <div className="mt-3 space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4096} placeholder={r.ai_draft ? "" : "Generate an AI draft or write a reply…"} />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tone} onChange={(e) => setTone(e.target.value)} className="!w-auto text-xs capitalize" aria-label="Tone">{TONES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
            <Button variant="secondary" disabled={Boolean(busy)} onClick={() => act("draft", { action: "draft", tone })}>
              {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {text ? "Regenerate" : "AI draft"}
            </Button>
            <Button variant="ghost" disabled={Boolean(busy)} onClick={() => act("ignore", { action: "ignore" })}><EyeOff className="h-4 w-4" /> Ignore</Button>
            <Button className="ml-auto" disabled={Boolean(busy) || !text.trim()} onClick={() => act("publish", { action: "publish", text })}>
              {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish reply
            </Button>
          </div>
          {r.ai_draft && text === r.ai_draft ? <p className="text-[11px] text-zinc-400">AI draft ({r.ai_draft_tone}) - review before publishing.</p> : null}
          {err ? <Alert>{err}</Alert> : null}
        </div>
      )}
    </li>
  );
}

export function ReviewInbox({ clients, initialClient = "", initialStatus = "UNREPLIED" }) {
  const [f, setF] = useState({ status: initialStatus, client: initialClient, max_stars: "", q: "" });
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const { data, error, loading, reload, mutate } = useApi(`/api/reviews/inbox?${new URLSearchParams({ ...f, page })}`);
  const items = data?.items || [];
  const s = data?.stats || {};
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  async function bulk(action, okText) {
    setBusy(action);
    setMsg(null);
    try {
      const r = await apiFetch("/api/reviews/inbox", { body: { action } });
      setMsg({ tone: "green", text: okText(r) });
      reload();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <PanelHeader icon={Inbox} tone="amber" title="Review inbox" subtitle="Every client's Google reviews in one place - newest problems first" count={s.unreplied ? `${s.unreplied} to reply` : null}
          actions={<>
            <Button variant="secondary" disabled={Boolean(busy)} onClick={() => bulk("sync", (r) => `Synced ${r.result.clients} listings · ${r.result.fresh} new review(s).`)}>
              {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync now
            </Button>
            <Button disabled={Boolean(busy) || !s.unreplied} onClick={() => bulk("draft_all", (r) => `${r.drafted} AI draft(s) ready - review and publish.`)}>
              {busy === "draft_all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Draft all
            </Button>
          </>} />
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5 sm:p-5">
          {[["Needs reply", s.unreplied, "bg-amber-50 dark:bg-amber-950/30"], ["Urgent (1-2★)", s.urgent, "bg-rose-50 dark:bg-rose-950/30"], ["New this week", s.new_7d, "bg-sky-50 dark:bg-sky-950/30"], ["Response rate", `${s.response_rate || 0}%`, "bg-emerald-50 dark:bg-emerald-950/30"], ["Avg rating", s.avg_rating || "-", "bg-violet-50 dark:bg-violet-950/30"]].map(([k, v, bg]) => (
            <div key={k} className={`rounded-xl p-3 ${bg}`}><p className="text-xs text-zinc-500">{k}</p><p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{v ?? 0}</p></div>
          ))}
        </div>
      </Card>
      <div className="grid gap-2 sm:grid-cols-4">
        <Select value={f.status} onChange={set("status")}><option value="UNREPLIED">Needs reply</option><option value="REPLIED">Replied</option><option value="IGNORED">Ignored</option><option value="ALL">All</option></Select>
        <Select value={f.client} onChange={set("client")}><option value="">All clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}</Select>
        <Select value={f.max_stars} onChange={set("max_stars")}><option value="">All ratings</option><option value="2">1-2 stars</option><option value="3">3 stars or less</option></Select>
        <Input value={f.q} onChange={set("q")} placeholder="Search text, reviewer, business" />
      </div>
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      {loading && !items.length ? <Skeleton className="h-40" /> : items.length ? (
        <ul className="space-y-3">{items.map((r) => <Row key={`${r.id}-${r.status}-${r.ai_draft_at}`} r={r} onChange={(item) => mutate((d) => ({ ...d, items: d.items.map((x) => (x.id === item.id ? { ...x, ...item } : x)) }))} />)}</ul>
      ) : <EmptyState icon={Inbox} title={f.status === "UNREPLIED" ? "Inbox zero 🎉" : "Nothing here"} text="New reviews arrive in real time (Pub/Sub) or every 30 minutes." />}
      {data?.total > 30 ? (
        <div className="flex justify-between"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-xs text-zinc-500">{data.total} reviews</span><Button variant="secondary" disabled={page * 30 >= data.total} onClick={() => setPage(page + 1)}>Next</Button></div>
      ) : null}
    </div>
  );
}
