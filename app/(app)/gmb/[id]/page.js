import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Map,
  MessageSquare,
  MousePointerClick,
  Pencil,
  Phone,
  Route,
  Search,
  Star,
  Wrench,
} from "lucide-react";
import { providerFor } from "@/lib/gmb/provider.js";
import { Badge, Card, Alert, EmptyState } from "@/components/ui";
import { MockBadge } from "@/components/status-badge";
import { GenerateNow } from "@/components/generate-now";
import { GmbReportActions } from "@/components/gmb-report-actions";
import { GmbProfileForm } from "@/components/gmb/profile-form";
import { GmbDetailTabs } from "@/components/gmb/detail-tabs";
import { DangerActions } from "@/components/danger-actions";
import { formatDate, formatInputDate, truncate } from "@/lib/utils";
import { one } from "@/lib/db";
import { requireTenantContext } from "@/lib/saas/context.js";

export const dynamic = "force-dynamic";

const DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function fmtTime(t) {
  if (t == null || t === "") return "";
  if (typeof t !== "object") return String(t);
  return `${String(t.hours ?? 0).padStart(2, "0")}:${String(t.minutes ?? 0).padStart(2, "0")}`;
}

/** Google regularHours -> [{ day, value }], grouped per day, in week order. */
function hoursRows(oh) {
  const periods = Array.isArray(oh)
    ? oh
    : Array.isArray(oh?.periods)
      ? oh.periods
      : null;
  if (!periods) {
    return oh && typeof oh === "object"
      ? Object.entries(oh).map(([k, v]) => ({
          day: k.replaceAll("_", " "),
          value: typeof v === "string" ? v : "",
        }))
      : [];
  }
  const byDay = new globalThis.Map();
  for (const p of periods) {
    const open = fmtTime(p.openTime) || "00:00";
    const close = fmtTime(p.closeTime) || "24:00";
    const allDay =
      open === "00:00" &&
      (close === "24:00" || (close === "00:00" && p.closeDay !== p.openDay));
    const val = allDay ? "Open 24 hours" : `${open} – ${close}`;
    byDay.set(p.openDay, [...(byDay.get(p.openDay) || []), val]);
  }
  return DAY_ORDER.map((d) => ({
    day: d.toLowerCase(),
    value: byDay.get(d)?.join(", ") || "Closed",
  }));
}

function Metric({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: "bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300",
    green:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300",
    red: "bg-rose-50 text-rose-600 dark:bg-rose-950/35 dark:text-rose-300",
    violet:
      "bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300",
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/35 dark:text-amber-300",
  };
  return (
    <div className={`rounded-xl p-3.5 ${tones[tone] || tones.blue}`}>
      <Icon className="h-4 w-4" />
      <p className="mt-2 text-xl font-bold leading-none text-zinc-950 tabular-nums dark:text-white">
        {Number(value || 0).toLocaleString("en-IN")}
      </p>
      <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </p>
    </div>
  );
}

/** Tiny server-rendered bar chart - zero client JS. */
function Trend({ series }) {
  if (!series.length) return null;
  const max = Math.max(1, ...series.map((r) => Number(r.views || 0)));
  const w = 100 / series.length;
  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className="h-24 w-full"
      role="img"
      aria-label="Daily views"
    >
      {series.map((r, i) => {
        const h = (Number(r.views || 0) / max) * 38;
        return (
          <rect
            key={r.stat_date || i}
            x={i * w + w * 0.15}
            y={40 - Math.max(h, 0.6)}
            width={w * 0.7}
            height={Math.max(h, 0.6)}
            rx="0.6"
            className="fill-sky-500/70"
          >
            <title>{`${r.stat_date}: ${r.views} views`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="min-w-0 text-right font-medium text-zinc-800 dark:text-zinc-200">
        {children || "—"}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, href }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
      <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
        <Icon className="h-4 w-4 text-[#F53236]" /> {title}
      </h2>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      ) : null}
    </div>
  );
}

const settled = (r, fallback) =>
  r.status === "fulfilled" ? r.value : fallback;

export default async function GmbProfilePage({ params, searchParams }) {
  const ctx = await requireTenantContext();
  const { id } = await params;
  const sp = await searchParams;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();

  const owned = await one(
    "SELECT id, google_email FROM clients WHERE id=? AND tenant_id=?",
    [clientId, ctx.tenantId],
  );
  if (!owned) notFound();

  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(today.getDate() - 30);
  const maxDate = formatInputDate(today);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(sp?.startDate || "")
    ? sp.startDate
    : formatInputDate(monthAgo);
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(sp?.endDate || "")
    ? sp.endDate
    : maxDate;

  const provider = await providerFor(clientId);
  const editing = Boolean(sp?.edit);

  // One failing Google call must not take the whole page down.
  const [profileR, postsR, perfR, rawR] = await Promise.allSettled([
    provider.getProfile(clientId),
    editing ? Promise.resolve([]) : provider.getPosts(clientId, 20),
    editing
      ? Promise.resolve(null)
      : provider.getPerformance(clientId, { startDate, endDate }),
    one("SELECT * FROM gmb_profiles WHERE client_id=? LIMIT 1", [clientId]),
  ]);

  const profile = settled(profileR, null);
  if (!profile) {
    if (profileR.status === "rejected") {
      return (
        <div className="mx-auto max-w-2xl space-y-4 pt-6">
          <Alert
            action={
              <Link className="font-semibold underline" href="/gmb">
                Back
              </Link>
            }
          >
            Could not load this listing:{" "}
            {profileR.reason?.message || "unknown error"}
          </Alert>
        </div>
      );
    }
    notFound();
  }

  if (editing) {
    const raw = settled(rawR, null);
    return (
      <GmbProfileForm
        clientId={clientId}
        profile={{
          ...(raw || {}),
          ...profile,
          location_name: profile.location_name || profile.business_name,
          map_url: raw?.map_url || profile.maps_url || "",
        }}
      />
    );
  }

  const posts = settled(postsR, []);
  const perf = settled(perfR, null);
  const series = Array.isArray(perf?.series) ? perf.series : [];
  const sum = (k) => series.reduce((s, r) => s + Number(r[k] || 0), 0);
  const hours = hoursRows(profile.opening_hours);
  const services = Array.isArray(profile.services) ? profile.services : [];
  const connected =
    profile.connection_status && profile.connection_status !== "DISCONNECTED";
  const editHref = `/gmb/${clientId}?edit=1`;
  const canConnect =
    typeof ctx.can === "function" ? ctx.can("gmb.connect") : true;

  const overview = (
    <div className="space-y-5">
      {profile.has_pending_edits ? (
        <Alert tone="amber">
          Some edits are waiting for Google review:{" "}
          {(profile.pending_fields || []).join(", ")}.
        </Alert>
      ) : null}
      {perfR.status === "rejected" ? (
        <Alert tone="amber">
          Performance data unavailable: {perfR.reason?.message}
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
            <Eye className="h-4 w-4 text-sky-500" /> Performance
            <span className="font-normal text-zinc-400">
              {perf?.is_mock
                ? "· prototype data"
                : `· ${startDate} → ${endDate}`}
            </span>
          </h2>
          <form method="GET" className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              name="startDate"
              defaultValue={startDate}
              max={endDate}
              aria-label="Start date"
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <input
              type="date"
              name="endDate"
              defaultValue={endDate}
              min={startDate}
              max={maxDate}
              aria-label="End date"
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="rounded-lg bg-[#F53236] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#e81d22]"
            >
              Apply
            </button>
          </form>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric
              icon={Search}
              label="Search views"
              value={sum("search_views") || sum("views")}
              tone="blue"
            />
            <Metric
              icon={Map}
              label="Maps views"
              value={sum("maps_views")}
              tone="violet"
            />
            <Metric
              icon={MousePointerClick}
              label="Website clicks"
              value={sum("clicks")}
              tone="green"
            />
            <Metric
              icon={Phone}
              label="Calls"
              value={sum("calls")}
              tone="red"
            />
            <Metric
              icon={Route}
              label="Directions"
              value={sum("direction_requests")}
              tone="amber"
            />
            <Metric
              icon={MessageSquare}
              label="Messages + bookings"
              value={sum("messages") + sum("bookings")}
              tone="blue"
            />
          </div>
          {series.length ? (
            <Trend series={series} />
          ) : (
            <p className="text-center text-xs text-zinc-400">
              No performance data for this range.
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <SectionTitle
            icon={Building2}
            title="Business profile"
            href={editHref}
          />
          <div className="divide-y divide-zinc-100 px-5 dark:divide-zinc-800">
            <Row label="Phone">{profile.phone}</Row>
            <Row label="Website">
              {profile.website ? (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1 text-sky-600 hover:underline dark:text-sky-400"
                >
                  <span className="truncate">
                    {profile.website.replace(/^https?:\/\//, "")}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              ) : null}
            </Row>
            <Row label="Category">
              {profile.category}
              {profile.additional_categories?.length ? (
                <span className="block text-xs font-normal text-zinc-400">
                  +{" "}
                  {profile.additional_categories.map((c) => c.name).join(", ")}
                </span>
              ) : null}
            </Row>
            <Row label="Rating">
              {Number(profile.rating) > 0 ? (
                <span>
                  <Star className="mr-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {Number(profile.rating).toFixed(1)} ({profile.review_count})
                </span>
              ) : (
                "See Reviews tab"
              )}
            </Row>
            <Row label="Status">
              <span
                className={`inline-flex items-center gap-1.5 ${connected ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-rose-500"}`}
                />
                {String(profile.connection_status || "unknown")
                  .replaceAll("_", " ")
                  .toLowerCase()}
              </span>
            </Row>
            {profile.maps_url ? (
              <Row label="Google Maps">
                <a
                  href={profile.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 hover:underline dark:text-sky-400"
                >
                  Open listing
                </a>
              </Row>
            ) : null}
          </div>
          <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <p className="mb-1 text-xs font-semibold text-zinc-500">
              Description
            </p>
            {profile.description ? (
              <p className="whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {profile.description}
              </p>
            ) : (
              <p className="text-sm text-zinc-400">
                No description.{" "}
                <Link href={editHref} className="font-semibold text-[#F53236]">
                  Add one
                </Link>{" "}
                - it helps ranking and conversions.
              </p>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionTitle icon={Clock} title="Opening hours" href={editHref} />
          <ul className="space-y-1 p-4">
            {hours.length ? (
              hours.map((h) => (
                <li
                  key={h.day}
                  className="flex justify-between gap-3 rounded-lg px-2 py-1.5 text-sm odd:bg-zinc-50 dark:odd:bg-zinc-900/60"
                >
                  <span className="capitalize text-zinc-500 dark:text-zinc-400">
                    {h.day}
                  </span>
                  <span
                    className={`font-medium ${h.value === "Closed" ? "text-zinc-400" : "text-zinc-800 dark:text-zinc-200"}`}
                  >
                    {h.value}
                  </span>
                </li>
              ))
            ) : (
              <li className="py-6 text-center text-sm text-zinc-400">
                Hours not set.
              </li>
            )}
          </ul>
          {profile.special_hours?.length ? (
            <div className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500 dark:border-zinc-800">
              <p className="mb-1 flex items-center gap-1 font-semibold">
                <CalendarDays className="h-3.5 w-3.5" /> Special hours
              </p>
              {profile.special_hours.slice(0, 5).map((s) => (
                <p key={s.date}>
                  {s.date}: {s.closed ? "Closed" : `${s.open} – ${s.close}`}
                </p>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <SectionTitle
          icon={Wrench}
          title={`Services (${services.length})`}
          href={editHref}
        />
        <div className="p-5">
          {services.length ? (
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <Badge key={s} tone="indigo">
                  {s}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              No services listed. Services help Google match you to more
              searches.
            </p>
          )}
        </div>
      </Card>
    </div>
  );

  const postsView = (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
          <FileText className="h-4 w-4 text-[#F53236]" /> Posts on Google
          <span className="font-normal text-zinc-400">
            · {posts.length} via {provider.name}
          </span>
        </h2>
        <Link
          href="/gmb/tasks"
          className="text-xs font-semibold text-[#F53236] hover:underline"
        >
          Review queue →
        </Link>
      </div>
      {postsR.status === "rejected" ? (
        <div className="p-4">
          <Alert>{postsR.reason?.message}</Alert>
        </div>
      ) : null}
      {posts.length ? (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {posts.map((p) => (
            <li key={p.id} className="flex gap-3 px-5 py-3.5">
              {p.image_url && !String(p.image_url).startsWith("data:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt=""
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <FileText className="h-5 w-5 text-zinc-400" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {truncate(p.title, 90) || "Untitled post"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {p.description}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                  <Badge>{p.post_type || "STANDARD"}</Badge>
                  <Badge tone={p.status === "DELETED" ? "red" : "emerald"}>
                    {p.status}
                  </Badge>
                  <span>{formatDate(p.published_at, true)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5">
          <EmptyState
            icon={FileText}
            title="No posts yet"
            text="Generate a post with AI, review it, then publish."
          />
        </div>
      )}
    </Card>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <Card className="px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F53236] text-white shadow-lg shadow-[#F53236]/25">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-bold text-zinc-950 sm:text-xl dark:text-white">
                  {profile.business_name}
                </h1>
                {profile.is_mock ? (
                  <MockBadge>Mock connection</MockBadge>
                ) : null}
              </div>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {profile.category}
                {profile.address ? ` · ${profile.address}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href={`/clients/${clientId}`}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Client record
            </Link>

            <Link
              href={editHref}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#F53236] transition hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit profile
            </Link>

  
            <GenerateNow clientId={clientId} />

            <DangerActions
              patchUrl={`/api/gmb/${clientId}`}
              deleteUrl={`/api/gmb/${clientId}`}
              active={connected}
              redirectTo="/gmb"
              deleteLabel="Remove GMB connection"
              deleteConfirm="This removes the GMB connection for this client. The client record stays. Continue?"
            />
          </div>
        </div>
      </Card>
          <GmbReportActions
              clientId={clientId}
              ownerEmail={owned?.google_email || ""}
            />

      <GmbDetailTabs
        clientId={clientId}
        initialTab={sp?.tab || "overview"}
        overview={overview}
        posts={postsView}
        reviewUrl={profile.review_url || ""}
        business={profile.business_name}
        canConnect={canConnect}
      />

      
    </div>
  );
}
