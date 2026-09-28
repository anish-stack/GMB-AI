"use client";

import { useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Share2,
} from "lucide-react";
import {
  Card,
  Button,
  Input,
  Alert,
  Skeleton,
  PanelHeader,
  Badge,
} from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

const LINKS = [
  ["maps", "Google Maps"],
  ["review", "Write a review"],
  ["search", "Google profile (search)"],
  ["website", "Website"],
];

function LinksCard({ clientId }) {
  const { data, error, loading } = useApi(
    `/api/gmb/${clientId}/qr?format=json`,
  );
  const [copied, setCopied] = useState("");
  const links = data?.links;
  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={Link2}
        title="Google links"
        subtitle="Real links from your Google Business Profile"
      />
      <div className="space-y-2 p-4 sm:p-5">
        {error ? <Alert>{error}</Alert> : null}
        {loading && !data ? (
          <Skeleton className="h-24" />
        ) : (
          LINKS.map(([k, label]) => (
            <div
              key={k}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 sm:flex-row sm:items-center dark:border-zinc-800"
            >
              <span className="w-44 shrink-0 text-xs font-semibold text-zinc-500">
                {label}
              </span>
              {links?.[k] ? (
                <>
                  <a
                    href={links[k]}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-sm text-sky-600 hover:underline dark:text-sky-400"
                  >
                    {links[k]}
                  </a>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      className="!p-2"
                      aria-label="Copy"
                      onClick={async () => {
                        await navigator.clipboard.writeText(links[k]);
                        setCopied(k);
                        setTimeout(() => setCopied(""), 1500);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <a href={links[k]} target="_blank" rel="noreferrer">
                      <Button
                        variant="ghost"
                        className="!p-2"
                        aria-label="Open"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                    {copied === k ? (
                      <span className="self-center text-xs text-emerald-600">
                        Copied
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                <span className="text-sm text-zinc-400">
                  Not available - connect & sync Google
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

const QR_TARGETS = [
  ["review", "Review", "Opens Google's “write a review” box directly."],
  ["maps", "Maps", "Opens your location in Google Maps."],
  ["search", "Profile", "Opens your Google Business Profile."],
  ["website", "Website", "Opens your website."],
];

function QrCard({ clientId }) {
  const { data } = useApi(`/api/gmb/${clientId}/qr?format=json`);
  const [target, setTarget] = useState("review");
  const [nonce, setNonce] = useState(0);
  const [broken, setBroken] = useState(false);
  const [copied, setCopied] = useState(false);

  const base = `/api/gmb/${clientId}/qr?target=${target}`;
  const current = QR_TARGETS.find((t) => t[0] === target);
  const link = data?.links?.[target];

  function pick(k) {
    if (k === target) return;
    setTarget(k);
    setBroken(false);
    setCopied(false);
    setNonce((n) => n + 1);
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={QrCode}
        tone="violet"
        title="Get your own Google QR"
        subtitle="Print it on the counter, bills or visiting cards"
      />

      <div className="p-4 sm:p-5">
        {/* target tabs */}
        <div
          role="tablist"
          className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900"
        >
          {QR_TARGETS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={target === k}
              onClick={() => pick(k)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                target === k
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* QR - fixed size, never grows */}
          <div className="shrink-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700">
            <div className="flex h-44 w-44 items-center justify-center overflow-hidden">
              {broken ? (
                <p className="px-2 text-center text-xs text-zinc-400">
                  No link yet for this QR - connect & sync Google.
                </p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${target}-${nonce}`}
                  src={base}
                  alt={`${current[1]} QR code`}
                  width={176}
                  height={176}
                  className="h-44 w-44 max-h-44 max-w-44 object-contain"
                  onError={() => setBroken(true)}
                />
              )}
            </div>
          </div>

          {/* details + actions */}
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <p className="text-base font-semibold text-zinc-900 dark:text-white">
                {current[1]} QR
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Customers scan with the phone camera - no app needed.{" "}
                {current[2]}
              </p>
            </div>

            {link ? (
              <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">
                  {link}
                </span>
                <button
                  type="button"
                  onClick={copyLink}
                  aria-label="Copy link"
                  className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <a href={`${base}&format=png`} download>
                <Button disabled={broken}>
                  <Download className="h-4 w-4" /> PNG
                </Button>
              </a>
              <a href={`${base}&format=svg`} download>
                <Button variant="secondary" disabled={broken}>
                  <Download className="h-4 w-4" /> SVG (print)
                </Button>
              </a>
              <a href={`${base}&poster=1`} target="_blank" rel="noreferrer">
                <Button variant="secondary" disabled={broken}>
                  <Printer className="h-4 w-4" /> Printable poster
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SocialCard({ clientId }) {
  const { data, error, loading, reload } = useApi(
    `/api/gmb/${clientId}/social`,
  );
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const items = data?.items || [];
  const groups = [
    ["social", "Social profiles"],
    ["message", "Chat / messaging"],
    ["booking", "Booking & ordering links"],
  ];
  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/api/gmb/${clientId}/social`, {
        method: "PUT",
        body: { values: draft },
      });
      setDraft({});
      reload();
      setMsg({ tone: "green", text: "Links saved to the listing." });
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={Share2}
        tone="green"
        title="Social profiles, chat & booking"
        subtitle="Instagram, Facebook, WhatsApp and booking links shown on Google"
        actions={
          <Button onClick={save} disabled={busy || !Object.keys(draft).length}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}{" "}
            Save
          </Button>
        }
      />
      <div className="space-y-5 p-4 sm:p-5">
        {error ? <Alert>{error}</Alert> : null}
        {data?.error ? (
          <Alert tone="amber">
            Couldn&apos;t read attributes from Google: {data.error}
          </Alert>
        ) : null}
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        {loading && !data ? (
          <Skeleton className="h-40" />
        ) : (
          groups.map(([g, title]) => (
            <section key={g}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                {title}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {items
                  .filter((i) => i.group === g)
                  .map((i) => (
                    <label key={i.id} className="block">
                      <span className="mb-1 flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {i.label}
                        {!i.supported && !data?.is_mock ? (
                          <Badge>may not apply to this category</Badge>
                        ) : null}
                      </span>
                      <Input
                        value={draft[i.id] ?? i.value}
                        placeholder={
                          i.id === "url_whatsapp"
                            ? "https://wa.me/9198xxxxxxxx"
                            : "https://"
                        }
                        onChange={(e) =>
                          setDraft({ ...draft, [i.id]: e.target.value })
                        }
                      />
                    </label>
                  ))}
              </div>
            </section>
          ))
        )}
        <p className="text-xs text-zinc-400">
          Booking buttons from partners (Reserve / Order) are managed in
          Business tools → Booking & order buttons.
        </p>
      </div>
    </Card>
  );
}

export function AutoReplyCard({ clientId }) {
  const { data, error, mutate } = useApi(
    `/api/clients/${clientId}/review-settings`,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save(patch) {
    setBusy(true);
    setErr("");
    try {
      const r = await apiFetch(`/api/clients/${clientId}/review-settings`, {
        method: "PUT",
        body: patch,
      });
      mutate((d) => ({ ...d, ...r }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return error ? <Alert>{error}</Alert> : null;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white">
              Auto-reply to reviews
            </p>
            <p className="text-xs text-zinc-500">
              {data.auto_reply
                ? `ON - new reviews with ${data.min_stars}★ or more get an AI reply published automatically. Lower ratings wait for you.`
                : "OFF - AI drafts replies; a person publishes them."}
            </p>
            {!data.platform_allowed ? (
              <p className="mt-1 text-xs text-amber-600">
                Disabled platform-wide by the admin.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={data.min_stars}
            disabled={busy || !data.auto_reply}
            onChange={(e) => save({ min_stars: Number(e.target.value) })}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            aria-label="Minimum stars"
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n}★ and above
              </option>
            ))}
          </select>
          <button
            type="button"
            role="switch"
            aria-checked={data.auto_reply}
            disabled={busy || !data.platform_allowed}
            onClick={() => save({ auto_reply: !data.auto_reply })}
            className={`relative h-7 w-12 rounded-full transition ${data.auto_reply ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"} disabled:opacity-50`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${data.auto_reply ? "left-6" : "left-1"}`}
            />
          </button>
        </div>
      </div>
      {err ? <Alert className="mt-3">{err}</Alert> : null}
    </Card>
  );
}

export function LinksPanel({ clientId }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  async function reimport() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiFetch(`/api/gmb/${clientId}/import`, { body: {} });
      const x = r.result;
      setMsg({
        tone: x.skipped ? "amber" : "green",
        text: x.skipped
          ? `Skipped: ${x.skipped}`
          : `Imported ${x.services} services, ${x.locations} locations, ${x.keywords} keywords${x.logo ? ", logo" : ""}.`,
      });
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Services, locations, keywords, logo and links are imported from Google
          automatically after connect/sync.
        </p>
        <Button variant="secondary" onClick={reimport} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}{" "}
          Re-import from Google
        </Button>
        {msg ? (
          <Alert tone={msg.tone} className="w-full">
            {msg.text}
          </Alert>
        ) : null}
      </Card>
      <LinksCard clientId={clientId} />
      <QrCard clientId={clientId} />
      <SocialCard clientId={clientId} />
    </div>
  );
}