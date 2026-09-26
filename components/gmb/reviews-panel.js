"use client";

import { memo, useMemo, useState } from "react";
import {
  CheckCircle2, Copy, Loader2, MessageCircle, MessageSquareReply, Pencil, RefreshCw,
  Send, Share2, Sparkles, Star, Trash2, UserRound, X,
} from "lucide-react";
import { Card, Button, Textarea, Select, Input, Alert, Skeleton, EmptyState, PanelHeader } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/hooks/use-api";

const TONES = ["professional", "friendly", "short", "apologetic", "grateful"];
const RATING = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const PAGE = 10;

const stars = (r) => (typeof r === "number" ? r : RATING[String(r || "").toUpperCase()] || Number(r) || 0);
const hasReply = (r) => Boolean(r.replied || r.reply?.comment);

function timeAgo(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Stars({ value }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-700"}`} />
      ))}
    </span>
  );
}

/* ---------------- one review + its reply editor ---------------- */
const ReviewCard = memo(function ReviewCard({ clientId, review, onSaved }) {
  const replied = hasReply(review);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply?.comment || "");
  const [tone, setTone] = useState(stars(review.rating) <= 2 ? "apologetic" : "professional");
  const [busy, setBusy] = useState(null); // "ai" | "save" | "delete"
  const [error, setError] = useState("");

  async function run(kind, fn) {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const base = `/api/gmb/${clientId}/reviews/${encodeURIComponent(review.id)}`;
  const draft = () =>
    run("ai", async () => {
      const json = await apiFetch(`${base}/generate-reply`, { body: { tone } });
      setText(json.reply || "");
      setEditing(true);
    });
  const publish = () =>
    run("save", async () => {
      const reply = text.trim();
      if (!reply) return;
      const json = await apiFetch(`${base}/reply`, { body: { reply } });
      setEditing(false);
      onSaved(review.id, { replied: true, reply: { comment: reply, updated_at: json.updated_at || new Date().toISOString() } });
    });
  const remove = () => {
    if (!window.confirm("Delete this business reply? The customer's review stays.")) return;
    run("delete", async () => {
      await apiFetch(`${base}/reply`, { method: "DELETE" });
      setText("");
      onSaved(review.id, { replied: false, reply: null });
    });
  };

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        {review.profile_photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={review.profile_photo} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <UserRound className="h-5 w-5 text-zinc-500" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{review.author || "Google user"}</p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                replied
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              }`}
            >
              {replied ? <CheckCircle2 className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
              {replied ? "Replied" : "Needs reply"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
            <Stars value={stars(review.rating)} />
            <span>{timeAgo(review.created_at)}</span>
          </div>
          <p className={`mt-3 whitespace-pre-line text-sm leading-6 ${review.comment ? "text-zinc-700 dark:text-zinc-300" : "italic text-zinc-400"}`}>
            {review.comment || "Rating only - no written review."}
          </p>
        </div>
      </div>

      {replied && !editing ? (
        <div className="mx-4 mb-4 rounded-xl border border-sky-100 bg-sky-50/60 p-3 sm:mx-5 dark:border-sky-900/40 dark:bg-sky-950/20">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300">
            <MessageSquareReply className="h-3.5 w-3.5" /> Your reply
            {review.reply?.updated_at ? <span className="font-normal text-sky-600/70">· {timeAgo(review.reply.updated_at)}</span> : null}
          </p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-300">{review.reply?.comment || "Reply published"}</p>
          <div className="mt-2 flex gap-4">
            <button type="button" onClick={() => { setText(review.reply?.comment || ""); setEditing(true); }} className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button type="button" onClick={remove} disabled={busy === "delete"} className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50">
              {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
            </button>
          </div>
        </div>
      ) : null}

      {!replied || editing ? (
        <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
          {editing ? (
            <div>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={4096} rows={4} placeholder="Write a reply..." className="bg-white dark:bg-zinc-950" />
              <p className="mt-1 text-right text-[11px] text-zinc-400">{text.length}/4096</p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tone} onChange={(e) => setTone(e.target.value)} className="!w-auto text-xs capitalize" aria-label="Reply tone">
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Button variant="secondary" onClick={draft} disabled={Boolean(busy)}>
              {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {text ? "Regenerate" : "AI draft"}
            </Button>
            {editing ? (
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => { setEditing(false); setText(review.reply?.comment || ""); setError(""); }} disabled={busy === "save"}>
                  <X className="h-4 w-4" /> Cancel
                </Button>
                <Button onClick={publish} disabled={busy === "save" || !text.trim()}>
                  {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {replied ? "Update" : "Publish"}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setEditing(true)}>Write manually</Button>
            )}
          </div>
          {error ? <Alert>{error}</Alert> : null}
        </div>
      ) : null}
    </article>
  );
});

/* ---------------- review request link (get more reviews) ---------------- */
function ReviewLink({ url, business }) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  const wa = `https://wa.me/?text=${encodeURIComponent(`Thank you for choosing ${business || "us"}! Could you share your experience here? ${url}`)}`;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <p className="text-xs text-emerald-800 dark:text-emerald-300">
        <span className="font-semibold">Get more reviews:</span> share the direct review link with happy customers.
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" className="!py-1.5 text-xs" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy link"}
        </Button>
        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
          <Share2 className="h-3.5 w-3.5" /> WhatsApp
        </a>
      </div>
    </div>
  );
}

/* ---------------- panel ---------------- */
export function ReviewsPanel({ clientId, reviewUrl, business }) {
  const { data, error, loading, reload, mutate } = useApi(`/api/gmb/${clientId}/reviews`);
  const [status, setStatus] = useState("all");
  const [rating, setRating] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const items = useMemo(() => data?.items || [], [data]);
  const stats = useMemo(() => {
    const replied = items.filter(hasReply).length;
    return {
      avg: Number(data?.average_rating || 0),
      total: Number(data?.total ?? items.length),
      replied,
      pending: items.length - replied,
      rate: items.length ? Math.round((replied / items.length) * 100) : 0,
    };
  }, [items, data]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((r) => {
      if (status === "unreplied" && hasReply(r)) return false;
      if (status === "replied" && !hasReply(r)) return false;
      if (rating !== "all" && stars(r.rating) !== Number(rating)) return false;
      if (term && !`${r.author} ${r.comment}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [items, status, rating, q]);

  const onSaved = (id, patch) => mutate((d) => ({ ...d, items: (d?.items || []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const filtersOn = status !== "all" || rating !== "all" || q;

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={Star}
        tone="amber"
        title="Google reviews"
        subtitle="Reply fast - response rate affects local ranking"
        count={stats.total || null}
        actions={
          <Button variant="secondary" onClick={reload} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-5">
        {error ? <Alert>{error}</Alert> : null}
        <ReviewLink url={reviewUrl} business={business} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Average", stats.avg.toFixed(1), "bg-amber-50 dark:bg-amber-950/30"],
            ["Total", stats.total, "bg-sky-50 dark:bg-sky-950/30"],
            ["Needs reply", stats.pending, "bg-rose-50 dark:bg-rose-950/30"],
            ["Response rate", `${stats.rate}%`, "bg-emerald-50 dark:bg-emerald-950/30"],
          ].map(([label, value, cls]) => (
            <div key={label} className={`rounded-xl p-3.5 ${cls}`}>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Search reviews..." className="sm:!w-56" aria-label="Search reviews" />
          <div className="flex gap-2">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setLimit(PAGE); }} className="!w-auto" aria-label="Reply status">
              <option value="all">All</option>
              <option value="unreplied">Needs reply</option>
              <option value="replied">Replied</option>
            </Select>
            <Select value={rating} onChange={(e) => { setRating(e.target.value); setLimit(PAGE); }} className="!w-auto" aria-label="Rating">
              <option value="all">All stars</option>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
            </Select>
          </div>
          {filtersOn ? (
            <button type="button" className="text-xs font-semibold text-[#F53236]" onClick={() => { setStatus("all"); setRating("all"); setQ(""); }}>
              Clear filters
            </button>
          ) : null}
          {items.length ? <span className="text-xs text-zinc-400 sm:ml-auto">{filtered.length} of {items.length}</span> : null}
        </div>

        {loading && !items.length ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        ) : filtered.length ? (
          <div className="space-y-3">
            {filtered.slice(0, limit).map((r) => (
              <ReviewCard key={r.id} clientId={clientId} review={r} onSaved={onSaved} />
            ))}
            {filtered.length > limit ? (
              <Button variant="secondary" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
                Show {Math.min(PAGE, filtered.length - limit)} more
              </Button>
            ) : null}
          </div>
        ) : (
          <EmptyState icon={MessageCircle} title={filtersOn ? "No reviews match" : "No reviews yet"} text={data?.note || "New Google reviews will show up here."} />
        )}
        {data?.note && items.length ? <Alert tone="amber">{data.note}</Alert> : null}
      </div>
    </Card>
  );
}
