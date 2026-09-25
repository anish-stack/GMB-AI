import Link from "next/link";
import { notFound } from "next/navigation";
import { getGMBProvider } from "@/lib/gmb/provider.js";
import { Badge } from "@/components/ui";
import { MockBadge } from "@/components/status-badge";
import { GenerateNow } from "@/components/generate-now";
import { GmbReportActions } from "@/components/gmb-report-actions";
import { GmbProfileForm } from "@/components/gmb-profile-form";
import { GmbSearchKeywordsPanel } from "@/components/gmb-search-keywords-panel";
import { GmbMediaPanel } from "@/components/gmb-media-panel";
import { GmbReviewsPanel } from "@/components/gmb-reviews-panel";
import { DangerActions } from "@/components/danger-actions";
import { formatDate, formatInputDate, truncate } from "@/lib/utils";
import { one } from "@/lib/db";
import { requireTenantContext } from "@/lib/saas/context.js";

export const dynamic = "force-dynamic";

function formatTime(t) {
  if (t == null || t === "") return "";

  if (typeof t === "string" || typeof t === "number") {
    return String(t);
  }

  if (typeof t === "object") {
    const h = String(t.hours ?? 0).padStart(2, "0");
    const m = String(t.minutes ?? 0).padStart(2, "0");

    return `${h}:${m}`;
  }

  return "";
}

function formatHoursValue(v) {
  if (v == null || v === "") return "";

  if (typeof v === "string" || typeof v === "number") {
    return String(v);
  }

  if (Array.isArray(v)) {
    return v.map(formatHoursValue).filter(Boolean).join(", ");
  }

  if (typeof v === "object") {
    if ("openTime" in v || "closeTime" in v) {
      const open = formatTime(v.openTime);
      const close = formatTime(v.closeTime);

      const crossDay = v.closeDay && v.openDay && v.closeDay !== v.openDay;

      return crossDay
        ? `${open} - ${v.closeDay} ${close}`
        : `${open} - ${close}`;
    }

    if ("open" in v || "close" in v) {
      return `${formatTime(v.open)} - ${formatTime(v.close)}`;
    }

    return "";
  }

  return "";
}

function hoursRows(oh) {
  if (!oh) return [];

  const periods = Array.isArray(oh)
    ? oh
    : Array.isArray(oh.periods)
      ? oh.periods
      : null;

  if (periods) {
    return periods.map((p, i) => ({
      key: `${p?.openDay || "period"}-${i}`,
      label: String(p?.openDay || `period ${i + 1}`).toLowerCase(),
      value: formatHoursValue(p),
    }));
  }

  if (typeof oh === "object") {
    return Object.entries(oh).map(([k, v]) => ({
      key: k,
      label: k.replaceAll("_", " "),
      value: formatHoursValue(v),
    }));
  }

  return [];
}

function Icon({ name, className = "h-4 w-4" }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (name === "building") {
    return (
      <svg {...common}>
        <path d="M4 21h16" />
        <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
        <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
      </svg>
    );
  }

  if (name === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg {...common}>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
      </svg>
    );
  }

  if (name === "eye") {
    return (
      <svg {...common}>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }

  if (name === "click") {
    return (
      <svg {...common}>
        <path d="m8 3 2 5M3 8l5 2M5 4l3 3M13 13l-2-7 7 2-3 2 4 4-2 2-4-4-2 3Z" />
      </svg>
    );
  }

  if (name === "phone") {
    return (
      <svg {...common}>
        <path d="M6.5 3.5 9 3l2 5-2 1.5a14 14 0 0 0 5.5 5.5L16 13l5 2-.5 2.5a3 3 0 0 1-3 2.5C10.1 19.4 4.6 13.9 4 6.5a3 3 0 0 1 2.5-3Z" />
      </svg>
    );
  }

  if (name === "route") {
    return (
      <svg {...common}>
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h-1" />
      </svg>
    );
  }

  if (name === "services") {
    return (
      <svg {...common}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  if (name === "post") {
    return (
      <svg {...common}>
        <path d="M6 3h9l3 3v15H6Z" />
        <path d="M14 3v4h4M9 12h6M9 16h6" />
      </svg>
    );
  }

  if (name === "pencil") {
    return (
      <svg {...common}>
        <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
        <path d="m14.5 7.5 3 3" />
      </svg>
    );
  }

  if (name === "external") {
    return (
      <svg {...common}>
        <path d="M14 4h6v6M20 4l-9 9" />
        <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
      </svg>
    );
  }

  return null;
}

export default async function GmbProfilePage({ params, searchParams }) {
  const ctx = await requireTenantContext();

  const { id } = await params;
  const sp = await searchParams;

  const today = new Date();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const defaultEndDate = formatInputDate(today);

  const defaultStartDate = formatInputDate(thirtyDaysAgo);

  const startDate = sp?.startDate || defaultStartDate;

  const endDate = sp?.endDate || defaultEndDate;

  const showPerformanceDetails = sp?.performanceDetails === "1";

  const clientId = Number(id);

  const owned = await one("SELECT id FROM clients WHERE id=? AND tenant_id=?", [
    clientId,
    ctx.tenantId,
  ]);

  if (!owned) {
    notFound();
  }

  const provider = getGMBProvider();

  const [profile, posts, reviews, performance, rawProfile, clientRow] =
    await Promise.all([
      provider.getProfile(clientId),

      provider.getPosts(clientId, 15),

      provider.getReviews(clientId),

      provider.getPerformance(clientId, {
        startDate,
        endDate,
      }),

      one("SELECT * FROM gmb_profiles WHERE client_id=? LIMIT 1", [clientId]),

      one("SELECT google_email FROM clients WHERE id=?", [clientId]),
    ]);

  if (!profile) {
    notFound();
  }

  if (sp?.edit) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Edit {profile.business_name}
        </h1>

        <GmbProfileForm
          clientId={clientId}
          profile={
            rawProfile
              ? {
                  ...rawProfile,
                  opening_hours: profile.opening_hours,
                }
              : {
                  location_name: profile.business_name,

                  category: profile.category,

                  address: profile.address,

                  phone: profile.phone,

                  website: profile.website,

                  opening_hours: profile.opening_hours,
                }
          }
        />
      </div>
    );
  }

  const performanceSeries = Array.isArray(performance?.series)
    ? performance.series
    : [];

  const totals = performanceSeries.reduce(
    (acc, row) => ({
      views: acc.views + Number(row.views || 0),

      clicks: acc.clicks + Number(row.clicks || 0),

      calls: acc.calls + Number(row.calls || 0),

      directions: acc.directions + Number(row.direction_requests || 0),
    }),
    {
      views: 0,
      clicks: 0,
      calls: 0,
      directions: 0,
    },
  );

  const hours = hoursRows(profile.opening_hours);

  const services = Array.isArray(profile.services) ? profile.services : [];

  const performanceDetailsHref = showPerformanceDetails
    ? `/gmb/${clientId}?startDate=${encodeURIComponent(
        startDate,
      )}&endDate=${encodeURIComponent(endDate)}`
    : `/gmb/${clientId}?startDate=${encodeURIComponent(
        startDate,
      )}&endDate=${encodeURIComponent(endDate)}&performanceDetails=1`;

  return (
    <div className="space-y-5 pb-8">
      {/* ================= HEADER ================= */}

      <div className="rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F53236] text-white shadow-[0_8px_24px_rgba(245,50,54,0.22)]">
              <Icon name="building" className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
                  {profile.business_name}
                </h1>

                {profile.is_mock ? (
                  <MockBadge>Mock GMB connection</MockBadge>
                ) : null}
              </div>

              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {profile.category}

                {profile.address ? ` · ${profile.address}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/clients/${clientId}`}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-[#F53236] transition hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Client record
            </Link>

            <Link
              href={`/gmb/${clientId}?edit=1`}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-[#F53236] transition hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Edit profile
            </Link>

            <GmbReportActions
              clientId={clientId}
              ownerEmail={clientRow?.google_email}
            />

            <GenerateNow clientId={clientId} />

            <DangerActions
              patchUrl={`/api/gmb/${clientId}`}
              deleteUrl={`/api/gmb/${clientId}`}
              active={profile.connection_status !== "DISCONNECTED"}
              redirectTo="/gmb"
              deleteLabel="Remove GMB connection"
              deleteConfirm="This removes the GMB connection for this client. The client record stays. Continue?"
            />
          </div>
        </div>
      </div>

      {/* ================= TOP CARDS ================= */}

      <div className="grid gap-5 xl:grid-cols-3">
        {/* PROFILE */}

        <section className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-red-50 via-white to-white shadow-sm dark:border-zinc-800 dark:from-red-950/20 dark:via-zinc-950 dark:to-zinc-950">
          <SectionHeader
            icon="building"
            title="Business Profile"
            action={
              <Link
                href={`/gmb/${clientId}?edit=1`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <Icon name="pencil" className="h-3.5 w-3.5" />
                Edit
              </Link>
            }
          />

          <div className="space-y-1 px-5 pb-5">
            <ProfileRow label="Phone" value={profile.phone} />

            <ProfileRow
              label="Website"
              value={
                profile.website ? (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-[240px] items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <span className="truncate">{profile.website}</span>

                    <Icon name="external" className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ) : (
                  "-"
                )
              }
            />

            <ProfileRow label="Location ID" value={profile.location_id} />

            <ProfileRow
              label="Connection"
              value={
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  {profile.connection_status || "-"}

                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
              }
            />

            <ProfileRow
              label="Rating"
              value={
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  <span className="mr-1 text-amber-400">★</span>
                  {Number(profile.rating || 0).toFixed(1)} (
                  {profile.review_count || 0} reviews)
                </span>
              }
            />
          </div>
        </section>

        {/* OPENING HOURS */}

        <section className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <SectionHeader
            icon="clock"
            title="Opening hours"
            action={
              <Link
                href={`/gmb/${clientId}?edit=1`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <Icon name="pencil" className="h-3.5 w-3.5" />
                Edit
              </Link>
            }
          />

          <div className="space-y-1.5 px-5 pb-5">
            {hours.length ? (
              hours.map((h) => (
                <div
                  key={h.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <span className="capitalize text-zinc-600 dark:text-zinc-400">
                    {h.label}
                  </span>

                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {h.value || "Closed"}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Opening hours are not set.
              </div>
            )}
          </div>
        </section>

        {/* PERFORMANCE */}

        <section className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <Icon name="chart" />
              </span>

              <div>
                <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                  Performance
                </h2>

                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {performance?.is_mock
                    ? "Prototype metrics"
                    : `${startDate} to ${endDate}`}
                </p>
              </div>
            </div>

            {/* VIEW DETAILS BUTTON */}

            <Link
              href={performanceDetailsHref}
              className="inline-flex shrink-0 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
            >
              {showPerformanceDetails ? "Hide Details" : "View Details"}
            </Link>
          </div>

          <div className="space-y-4 p-5">
            <form
              method="GET"
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  Start date
                </label>

                <input
                  type="date"
                  name="startDate"
                  defaultValue={startDate}
                  max={endDate}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#F53236] focus:ring-4 focus:ring-[#F53236]/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  End date
                </label>

                <input
                  type="date"
                  name="endDate"
                  defaultValue={endDate}
                  min={startDate}
                  max={defaultEndDate}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#F53236] focus:ring-4 focus:ring-[#F53236]/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#F53236] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e81d22] sm:w-auto"
                >
                  Apply
                </button>
              </div>
            </form>

            {/* PERFORMANCE CARDS */}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric
                icon="eye"
                label="Views"
                value={totals.views}
                tone="blue"
              />

              <Metric
                icon="click"
                label="Clicks"
                value={totals.clicks}
                tone="green"
              />

              <Metric
                icon="phone"
                label="Calls"
                value={totals.calls}
                tone="red"
              />

              <Metric
                icon="route"
                label="Directions"
                value={totals.directions}
                tone="violet"
              />
            </div>
          </div>
        </section>
      </div>

      {/* ================= PERFORMANCE DETAILS ================= */}

      {showPerformanceDetails ? (
        <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                Performance details
              </h2>

              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Daily metrics from {startDate} to {endDate}
              </p>
            </div>

            <Link
              href={`/gmb/${clientId}?startDate=${encodeURIComponent(
                startDate,
              )}&endDate=${encodeURIComponent(endDate)}`}
              className="text-xs font-semibold text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Close details
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>

                  <th className="px-5 py-3 font-semibold">Views</th>

                  <th className="px-5 py-3 font-semibold">Clicks</th>

                  <th className="px-5 py-3 font-semibold">Calls</th>

                  <th className="px-5 py-3 font-semibold">Directions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {performanceSeries.length ? (
                  performanceSeries.map((row, index) => (
                    <tr
                      key={row.stat_date || row.day || index}
                      className="transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60"
                    >
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                        {row.stat_date || row.day || "-"}
                      </td>

                      <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                        {Number(row.views || 0)}
                      </td>

                      <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                        {Number(row.clicks || 0)}
                      </td>

                      <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                        {Number(row.calls || 0)}
                      </td>

                      <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                        {Number(row.direction_requests || 0)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400"
                    >
                      No performance data available for this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ================= SERVICES ================= */}

      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Icon name="services" />
            </span>

            <h2 className="text-base font-bold text-zinc-950 dark:text-white">
              Services
            </h2>
          </div>

          <Link
            href={`/gmb/${clientId}?edit=1`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-[#F53236] transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30"
          >
            <span className="text-base leading-none">+</span>
            Add Service
          </Link>
        </div>

        <div className="min-h-[130px] p-5">
          {services.length ? (
            <div className="flex flex-wrap gap-2">
              {services.map((service) => (
                <Badge key={service} tone="indigo">
                  {service}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[90px] flex-col items-center justify-center text-center">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
                <Icon name="services" className="h-5 w-5" />
              </div>

              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                No services added yet
              </p>

              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Add your business services so customers can quickly see what you
                offer.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ================= POSTS ================= */}

      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-[#F53236] dark:bg-red-950/30">
              <Icon name="post" />
            </span>

            <div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                Posts
              </h2>

              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {posts.length} posts via {provider.name} provider
              </p>
            </div>
          </div>

          <span className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            All Posts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
              <tr>
                <th className="w-14 px-5 py-3 font-semibold">#</th>

                <th className="px-5 py-3 font-semibold">Title</th>

                <th className="px-5 py-3 font-semibold">Type</th>

                <th className="px-5 py-3 font-semibold">Status</th>

                <th className="px-5 py-3 font-semibold">External ID</th>

                <th className="px-5 py-3 font-semibold">Published</th>

                <th className="w-20 px-5 py-3 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {posts.length ? (
                posts.map((post, index) => (
                  <tr
                    key={post.id}
                    className="transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60"
                  >
                    <td className="px-5 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {index + 1}
                    </td>

                    <td className="min-w-[280px] px-5 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                      {truncate(post.title, 58)}
                    </td>

                    <td className="px-5 py-3">
                      <Badge>{post.post_type}</Badge>
                    </td>

                    <td className="px-5 py-3">
                      <Badge tone="emerald">{post.status}</Badge>
                    </td>

                    <td className="max-w-[430px] px-5 py-3 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      <div className="truncate" title={post.external_id || ""}>
                        {post.external_id || "-"}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(post.published_at, true)}
                    </td>

                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        aria-label={`Actions for ${post.title || "post"}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                      >
                        ⋮
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400"
                  >
                    No posts published yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <GmbSearchKeywordsPanel clientId={clientId} />

      <GmbMediaPanel clientId={clientId} />

      <GmbReviewsPanel clientId={clientId} initialReviews={reviews} />

      {reviews?.note ? (
        <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
          {reviews.note}
        </p>
      ) : null}
    </div>
  );
}

/* ======================================================
   REUSABLE UI COMPONENTS
====================================================== */

function SectionHeader({ icon, title, action }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-[#F53236] dark:bg-red-950/30">
          <Icon name={icon} />
        </span>

        <h2 className="text-base font-bold text-zinc-950 dark:text-white">
          {title}
        </h2>
      </div>

      {action}
    </div>
  );
}

function ProfileRow({ label, value }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-2 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>

      <div className="min-w-0 truncate text-right font-medium text-zinc-800 dark:text-zinc-200">
        {value || "-"}
      </div>
    </div>
  );
}

function Metric({ icon, label, value, tone }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/35 dark:text-blue-300",

    green:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300",

    red: "bg-red-50 text-red-500 dark:bg-red-950/35 dark:text-red-300",

    violet:
      "bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300",
  };

  return (
    <div className={`rounded-xl p-3.5 ${tones[tone] || tones.blue}`}>
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 shadow-sm dark:bg-zinc-950/40">
        <Icon name={icon} className="h-4 w-4" />
      </div>

      <p className="text-xl font-bold leading-none text-zinc-950 dark:text-white">
        {value}
      </p>

      <p className="mt-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </p>
    </div>
  );
}
