"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Globe, Loader2, Pencil, Plus, Trash2, Eye, EyeOff, LayoutDashboard, Sparkles, RefreshCw } from "lucide-react";
import { Card, Button, Alert, Skeleton, EmptyState, PanelHeader, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

/** Build / edit / publish / delete this client's website in the Website Builder - no separate login. */
export function WebsitePanel({ clientId }) {
  const { data, error, loading, reload } = useApi(`/api/gmb/${clientId}/website`);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const sites = data?.websites || [];

  async function act(action, website_id, confirmText, extra = null) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(`${action}:${website_id || ""}`);
    setMsg(null);
    try {
      const r = await apiFetch(`/api/gmb/${clientId}/website`, { body: { action, website_id, ...(extra || {}) } });
      if (action === "ai_images") {
        setMsg({ tone: "green", text: `Generating ${r.started} AI images (hero, about, services) - you'll get a notification in 1-2 minutes.` });
      } else if (["publish", "unpublish", "delete", "refill"].includes(action)) {
        setMsg({ tone: "green", text: action === "delete" ? "Website deleted." : action === "refill" ? "Website updated with the latest Google data." : r.isLive ? `Live at ${r.liveUrl}` : "Website unpublished." });
        reload();
      }
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }
  const spin = (k) => busy === k;

  return (
    <Card className="overflow-hidden">
      <PanelHeader icon={Globe} tone="blue" title="Website" subtitle="Build, edit and publish this business's website right here - no separate login"
        actions={data?.configured ? <>
          <Link href={`/gmb/${clientId}/website`}><Button variant="secondary"><LayoutDashboard className="h-4 w-4" /> Open builder</Button></Link>
          <Link href={`/gmb/${clientId}/website?new=1`}><Button variant="secondary"><Plus className="h-4 w-4" /> Blank website</Button></Link>
          <Link href={`/gmb/${clientId}/website/new`}><Button><Sparkles className="h-4 w-4" /> Create from Google</Button></Link>
        </> : null} />
      <div className="space-y-3 p-4 sm:p-5">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        {loading && !data ? <Skeleton className="h-28" /> : !data?.configured ? (
          <Alert tone="amber">The website builder isn&apos;t connected yet. Super admin: Admin → Integrations → Website Builder (API URL, panel URL, integration key).</Alert>
        ) : sites.length ? sites.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
                {s.slug} <Badge tone={s.isLive ? "emerald" : "slate"}>{s.isLive ? "Live" : "Draft"}</Badge>
              </p>
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline">{s.url} <ExternalLink className="h-3 w-3" /></a>
              <p className="text-[11px] text-zinc-400">Theme {s.themeKey || "-"}{s.updatedAt ? ` · updated ${new Date(s.updatedAt).toLocaleDateString("en-IN")}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/gmb/${clientId}/website?site=${s.id}`}><Button variant="secondary"><Pencil className="h-4 w-4" /> Edit</Button></Link>
              <Button variant="secondary" title="Fill empty fields with the latest Google data (keeps your edits)" onClick={() => act("refill", s.id, null, { mode: "fill" })} disabled={Boolean(busy)}>
                {spin(`refill:${s.id}`) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Fill from Google
              </Button>
              <Button variant="secondary" title="AI photos for hero, about and every service" onClick={() => act("ai_images", s.id, "Generate AI images for the hero, about and every service? This uses AI credits and replaces those images.")} disabled={Boolean(busy)}>
                {spin(`ai_images:${s.id}`) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} AI images
              </Button>
              <Button variant="ghost" title="Replace website content with Google data" onClick={() => act("refill", s.id, "Replace this website's text, services, reviews, contact and SEO with the latest Google data? Your manual edits to those fields will be overwritten.", { mode: "overwrite" })} disabled={Boolean(busy)}>Reset to Google</Button>
              {s.isLive ? (
                <Button variant="secondary" onClick={() => act("unpublish", s.id, "Take this website offline?")} disabled={Boolean(busy)}><EyeOff className="h-4 w-4" /> Unpublish</Button>
              ) : (
                <Button onClick={() => act("publish", s.id)} disabled={Boolean(busy)}>{spin(`publish:${s.id}`) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Publish</Button>
              )}
              <Button variant="dangerGhost" onClick={() => act("delete", s.id, `Delete ${s.slug} permanently? Pages, images and form submissions are removed.`)} disabled={Boolean(busy)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        )) : <EmptyState icon={Globe} title="No website yet" text="Pick a theme - name, logo, photos, about, services, reviews, contact, hours, social links and SEO are filled from Google automatically." action={<Link href={`/gmb/${clientId}/website/new`}><Button><Sparkles className="h-4 w-4" /> Create from Google</Button></Link>} />}
      </div>
    </Card>
  );
}
