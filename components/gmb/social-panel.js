"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, ExternalLink, Heart, Loader2, MessageCircle, Plus, RefreshCw, Send, Trash2, Unlink } from "lucide-react";
import { Card, Button, Input, Textarea, Select, Alert, Skeleton, Badge, EmptyState } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

const FB = "#1877F2";
const IGG = "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)";

function Logo({ platform, className = "h-5 w-5" }) {
  return platform === "facebook" ? (
    <svg viewBox="0 0 24 24" className={className} fill={FB}><path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" /></svg>
  ) : (
    <span className={`inline-flex items-center justify-center rounded-md text-white ${className}`} style={{ background: IGG }}>
      <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>
    </span>
  );
}

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`flex items-center justify-between gap-3 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

function PagePicker({ clientId, pick, onDone }) {
  const [pages, setPages] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let alive = true;
    apiFetch(`/api/gmb/${clientId}/social-meta`, { body: { action: "pages", pick } }).then((r) => alive && setPages(r.pages)).catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [clientId, pick]);
  async function choose(p, instagram) {
    setBusy(p.id);
    try {
      await apiFetch(`/api/gmb/${clientId}/social-meta`, { body: { action: "connect", pick, page_id: p.id, instagram } });
      onDone(`Connected ${p.name}${instagram && p.instagram ? ` + @${p.instagram.username}` : ""}.`);
    } catch (e) {
      setErr(e.message);
      setBusy("");
    }
  }
  return (
    <Card className="p-5">
      <p className="font-semibold">Choose the Facebook page for this client</p>
      <p className="mb-3 text-xs text-zinc-500">The Instagram account linked to the page is connected with it (needed for Instagram posts and auto-DM).</p>
      {err ? <Alert className="mb-3">{err}</Alert> : null}
      {!pages && !err ? <Skeleton className="h-24" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {(pages || []).map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              {p.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.picture} alt="" className="h-11 w-11 rounded-full" />
              ) : <Logo platform="facebook" className="h-11 w-11" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="truncate text-xs text-zinc-500">{p.instagram ? `Instagram: @${p.instagram.username}` : "No Instagram linked to this page"}</p>
              </div>
              <Button disabled={Boolean(busy)} onClick={() => choose(p, true)}>{busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Connect</Button>
            </div>
          ))}
          {pages && !pages.length ? <p className="text-sm text-zinc-500">No pages found. The Facebook user must be an admin of the page and grant access to it.</p> : null}
        </div>
      )}
    </Card>
  );
}

function AccountCard({ clientId, platform, acc, onChange }) {
  const [busy, setBusy] = useState("");
  const save = async (patch) => {
    setBusy("s");
    try {
      await apiFetch(`/api/gmb/${clientId}/social-meta`, { body: { action: "settings", platform, ...patch } });
      onChange();
    } finally {
      setBusy("");
    }
  };
  const name = platform === "facebook" ? "Facebook page" : "Instagram";
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Logo platform={platform} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{name}</p>
          <p className="truncate text-xs text-zinc-500">{acc ? (platform === "facebook" ? acc.page_name : `@${acc.ig_username}`) : "Not connected"}</p>
        </div>
        {acc ? <Badge tone={acc.status === "ACTIVE" ? "emerald" : "red"}>{acc.status === "ACTIVE" ? "Connected" : "Reconnect"}</Badge> : null}
      </div>
      {acc ? (
        <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <Toggle label="Auto-publish every GMB post here" checked={Boolean(acc.auto_publish)} disabled={busy === "s"} onChange={(v) => save({ auto_publish: v })} />
          {acc.last_error ? <p className="text-xs text-rose-600">{acc.last_error}</p> : null}
          <Button variant="dangerGhost" className="!px-0" onClick={async () => { if (!window.confirm(`Disconnect ${name}?`)) return; await apiFetch(`/api/gmb/${clientId}/social-meta`, { body: { action: "disconnect", platform } }); onChange(); }}><Unlink className="h-4 w-4" /> Disconnect</Button>
        </div>
      ) : (
        <form action={`/api/social/${clientId}/connect`} method="GET" className="mt-4">
          <Button type="submit" className="w-full justify-center">Connect {platform === "facebook" ? "Facebook page" : "Instagram (via its Facebook page)"}</Button>
        </form>
      )}
    </Card>
  );
}

function Composer({ clientId, accounts, posts, onDone }) {
  const [targets, setTargets] = useState({ facebook: Boolean(accounts.facebook), instagram: false });
  const [taskId, setTaskId] = useState("");
  const [message, setMessage] = useState("");
  const [image, setImage] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  async function go() {
    setBusy(true);
    setRes(null);
    const out = [];
    for (const platform of ["facebook", "instagram"].filter((p) => targets[p] && accounts[p])) {
      try {
        const r = await apiFetch(`/api/gmb/${clientId}/social-meta`, { body: { action: "publish", platform, message, image_url: image || undefined, link: link || undefined, task_id: taskId || undefined } });
        out.push({ platform, ok: true, permalink: r.permalink });
      } catch (e) {
        out.push({ platform, ok: false, error: e.message });
      }
    }
    setRes(out);
    setBusy(false);
    onDone();
  }
  return (
    <Card className="p-5">
      <p className="mb-3 font-semibold">Create a post</p>
      <div className="mb-3 flex flex-wrap gap-4">
        {["facebook", "instagram"].map((p) => (
          <label key={p} className={`flex items-center gap-2 text-sm ${accounts[p] ? "" : "opacity-40"}`}>
            <input type="checkbox" className="h-4 w-4 accent-brand-500" disabled={!accounts[p]} checked={targets[p] && Boolean(accounts[p])} onChange={(e) => setTargets({ ...targets, [p]: e.target.checked })} />
            <Logo platform={p} className="h-4 w-4" /> {p === "facebook" ? "Facebook" : "Instagram"}
          </label>
        ))}
      </div>
      <div className="grid gap-3">
        <label className="block text-xs font-semibold text-zinc-600">Use a GMB post (text + image)
          <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="mt-1">
            <option value="">- Write a new post -</option>
            {posts.map((p) => <option key={p.id} value={p.id}>{(p.title || p.description || "").slice(0, 70)}</option>)}
          </Select>
        </label>
        <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={taskId ? "Leave empty to use the GMB post text" : "What do you want to share?"} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder={taskId ? "Image URL (empty = GMB post image)" : "Image URL (https://…) - required for Instagram"} />
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (optional) - website / booking page" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={go} disabled={busy || (!targets.facebook && !targets.instagram) || (!message && !taskId && !image)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish now</Button>
        <span className="text-xs text-zinc-400">Instagram needs an image.</span>
      </div>
      {res ? (
        <div className="mt-3 space-y-1">
          {res.map((r) => <Alert key={r.platform} tone={r.ok ? "green" : "red"}>{r.platform}: {r.ok ? <>published {r.permalink ? <a href={r.permalink} target="_blank" rel="noreferrer" className="underline">view</a> : null}</> : r.error}</Alert>)}
        </div>
      ) : null}
    </Card>
  );
}

function Feed({ clientId, accounts }) {
  const [platform, setPlatform] = useState(accounts.facebook ? "facebook" : "instagram");
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    apiFetch(`/api/gmb/${clientId}/social-meta`, { body: { action: "feed", platform } }).then((r) => { if (alive) { setItems(r.items); setErr(""); } }).catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [clientId, platform, n]);
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-semibold">Recent posts</p>
        <div className="flex items-center gap-2">
          {["facebook", "instagram"].filter((p) => accounts[p]).map((p) => (
            <button key={p} type="button" onClick={() => { setItems(null); setPlatform(p); }} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${platform === p ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>{p === "facebook" ? "Facebook" : "Instagram"}</button>
          ))}
          <button type="button" onClick={() => { setItems(null); setN(n + 1); }} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>
      {err ? <Alert>{err}</Alert> : !items ? <Skeleton className="h-40" /> : items.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <a key={p.id} href={p.permalink} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-zinc-200 hover:border-zinc-300 dark:border-zinc-800">
              <div className="aspect-square bg-zinc-100 dark:bg-zinc-800">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-300">{p.message || "(no text)"}</p>
                <p className="flex items-center gap-3 text-[11px] text-zinc-400"><span className="flex items-center gap-1"><Heart className="h-3 w-3" />{p.reactions}</span><span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p.comments}</span><span className="ml-auto">{new Date(p.created).toLocaleDateString("en-IN")}</span><ExternalLink className="h-3 w-3" /></p>
              </div>
            </a>
          ))}
        </div>
      ) : <p className="text-sm text-zinc-500">No posts yet.</p>}
    </Card>
  );
}

function DmCard({ clientId, acc, rules, dms, onChange }) {
  const [kw, setKw] = useState("");
  const [reply, setReply] = useState("");
  const [fallback, setFallback] = useState(acc.dm_fallback || "");
  const [busy, setBusy] = useState("");
  const call = async (body, key) => {
    setBusy(key);
    try {
      await apiFetch(`/api/gmb/${clientId}/social-meta`, { body });
      onChange();
    } finally {
      setBusy("");
    }
  };
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/30"><Bot className="h-5 w-5" /></span>
        <div><p className="font-semibold">Instagram auto-reply to DMs</p><p className="text-xs text-zinc-500">Keyword rules first, then AI from the business facts, then the fallback text. Max 3 auto replies per person per 10 minutes.</p></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Toggle label="Auto-reply ON" checked={Boolean(acc.dm_auto_reply)} disabled={Boolean(busy)} onChange={(v) => call({ action: "settings", platform: "instagram", dm_auto_reply: v }, "on")} />
        <Toggle label="Use AI when no rule matches" checked={Boolean(acc.dm_use_ai)} disabled={Boolean(busy)} onChange={(v) => call({ action: "settings", platform: "instagram", dm_use_ai: v }, "ai")} />
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={fallback} onChange={(e) => setFallback(e.target.value)} placeholder="Fallback reply, e.g. Thanks! Our team will reply shortly. Call 98xxxxxx for urgent help." />
        <Button variant="secondary" disabled={busy === "fb"} onClick={() => call({ action: "settings", platform: "instagram", dm_fallback: fallback }, "fb")}>Save</Button>
      </div>

      <p className="mb-2 mt-5 text-sm font-semibold">Keyword rules</p>
      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <div className="min-w-0 flex-1"><p className="font-medium">{r.keywords}</p><p className="text-xs text-zinc-500">{r.reply}</p></div>
            <button type="button" onClick={() => call({ action: "rule_toggle", rule_id: r.id }, `t${r.id}`)} className="text-xs font-semibold text-zinc-500">{r.active ? "On" : "Off"}</button>
            <button type="button" onClick={() => call({ action: "rule_delete", rule_id: r.id }, `d${r.id}`)} className="text-rose-500" aria-label="Delete rule"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="grid gap-2 rounded-xl border border-dashed border-zinc-300 p-3 md:grid-cols-[1fr_2fr_auto] dark:border-zinc-700">
          <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="price, cost, rate" />
          <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply sent when a keyword appears" />
          <Button disabled={!kw || !reply || busy === "add"} onClick={async () => { await call({ action: "rule_add", keywords: kw, reply }, "add"); setKw(""); setReply(""); }}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </div>

      <p className="mb-2 mt-5 text-sm font-semibold">Recent DMs</p>
      {dms.length ? (
        <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {dms.map((d) => (
            <li key={d.id} className="p-3 text-xs">
              <p className="text-zinc-700 dark:text-zinc-200">💬 {d.message || "(attachment)"}</p>
              {d.reply ? <p className="mt-1 text-zinc-500">↳ {d.reply}</p> : null}
              <p className="mt-1 flex gap-2 text-[11px] text-zinc-400"><Badge tone={d.source === "ERROR" ? "red" : d.source === "AI" ? "violet" : "slate"}>{d.source}</Badge>{d.error ? <span className="text-rose-500">{d.error}</span> : null}<span className="ml-auto">{new Date(d.created_at).toLocaleString("en-IN")}</span></p>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-zinc-500">No messages yet.</p>}
    </Card>
  );
}

export function SocialPanel({ clientId }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pick = sp.get("pick");
  const urlError = sp.get("social_error");
  const { data, error, loading, reload } = useApi(`/api/gmb/${clientId}/social-meta`);
  const recent = useApi(`/api/gmb/${clientId}/social-meta-posts`);
  const [msg, setMsg] = useState(null);
  if (loading && !data) return <Skeleton className="h-64" />;
  if (error) return <Alert>{error}</Alert>;
  if (!data?.enabled) return <EmptyState title="Not available" text="Facebook & Instagram tools are in test mode - the platform admin enables them per workspace." />;
  const acc = data.accounts || {};
  return (
    <div className="space-y-5">
      {!data.configured ? <Alert tone="amber">The Meta app isn&apos;t configured yet (super admin: Admin → Integrations → Meta).</Alert> : null}
      {urlError ? <Alert>{urlError}</Alert> : null}
      {msg ? <Alert tone="green">{msg}</Alert> : null}
      {pick ? <PagePicker clientId={clientId} pick={pick} onDone={(m) => { setMsg(m); router.replace(`/gmb/${clientId}?tab=social`); reload(); }} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <AccountCard clientId={clientId} platform="facebook" acc={acc.facebook} onChange={reload} />
        <AccountCard clientId={clientId} platform="instagram" acc={acc.instagram} onChange={reload} />
      </div>
      {acc.facebook || acc.instagram ? (
        <>
          <Composer clientId={clientId} accounts={acc} posts={recent.data?.items || []} onDone={reload} />
          <Feed clientId={clientId} accounts={acc} />
        </>
      ) : null}
      {acc.instagram ? <DmCard clientId={clientId} acc={acc.instagram} rules={data.rules || []} dms={data.dms || []} onChange={reload} /> : null}
      {data.log?.length ? (
        <Card className="p-5">
          <p className="mb-2 font-semibold">Publishing history</p>
          <ul className="divide-y divide-zinc-100 text-xs dark:divide-zinc-800">
            {data.log.map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-2">
                <Logo platform={l.platform} className="h-4 w-4" />
                <span className="min-w-0 flex-1 truncate">{l.message}</span>
                <Badge tone={l.status === "PUBLISHED" ? "emerald" : "red"}>{l.status}</Badge>
                {l.permalink ? <a href={l.permalink} target="_blank" rel="noreferrer" className="text-sky-600">view</a> : <span className="max-w-40 truncate text-rose-500">{l.error}</span>}
                <span className="text-zinc-400">{new Date(l.created_at).toLocaleDateString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
