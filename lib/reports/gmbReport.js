import "server-only";
import { one, query } from "../db.js";
import { providerFor } from "../gmb/provider.js";

const iso = (d) => d.toISOString().slice(0, 10);
const RATING = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const stars = (r) => (typeof r === "number" ? r : RATING[String(r || "").toUpperCase()] || Number(r) || 0);
const METRICS = ["views", "search_views", "maps_views", "clicks", "calls", "direction_requests", "messages", "bookings"];

function sumSeries(series) {
  const t = Object.fromEntries(METRICS.map((k) => [k, 0]));
  for (const r of series) for (const k of METRICS) t[k] += Number(r[k] || 0);
  if (!t.search_views && !t.maps_views) t.search_views = t.views;
  t.actions = t.clicks + t.calls + t.direction_requests + t.messages + t.bookings;
  t.conversion = t.views ? Math.round((t.actions / t.views) * 1000) / 10 : 0;
  return t;
}

const change = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);

async function performance(provider, clientId, start, end) {
  try {
    const r = await provider.getPerformance(clientId, { startDate: iso(start), endDate: iso(end) });
    return { series: r.series || [], source: r.is_mock ? "mock" : "google_live" };
  } catch {
    const rows = await query(
      `SELECT DATE_FORMAT(stat_date,'%Y-%m-%d') stat_date, views, clicks, calls, direction_requests
         FROM gmb_performance WHERE client_id=? AND stat_date BETWEEN ? AND ? ORDER BY stat_date`,
      [clientId, iso(start), iso(end)],
    );
    return { series: rows, source: rows.length ? "cache_fallback" : "none" };
  }
}

function settled(r, fallback) {
  return r.status === "fulfilled" ? r.value : fallback;
}

/**
 * Collects everything the report needs in parallel. Every section is
 * optional: a failing Google call just leaves that section empty.
 */
export async function buildGmbReport(clientId, days = 30) {
  const span = Math.min(Math.max(Number(days) || 30, 7), 365);
  const client = await one(
    `SELECT c.id, c.tenant_id, c.business_name, c.business_category, c.city, c.phone, c.website, c.address,
            c.description, c.google_email, c.gmb_connection_status, t.name AS agency_name, t.company_email AS agency_email
       FROM clients c LEFT JOIN tenants t ON t.id=c.tenant_id WHERE c.id=?`,
    [clientId],
  );
  if (!client) throw Object.assign(new Error(`Client ${clientId} not found`), { status: 404 });

  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (span - 1));
  const prevEnd = new Date(start);
  prevEnd.setDate(start.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - (span - 1));

  const provider = await providerFor(clientId);
  const [profileR, curR, prevR, reviewsR, keywordsR, mediaR, postsR] = await Promise.allSettled([
    provider.getProfile(clientId),
    performance(provider, clientId, start, end),
    performance(provider, clientId, prevStart, prevEnd),
    provider.getReviews(clientId),
    provider.getSearchKeywords ? provider.getSearchKeywords(clientId, {}) : Promise.resolve(null),
    provider.getMedia ? provider.getMedia(clientId) : Promise.resolve([]),
    query(
      `SELECT title, post_type, status, published_at FROM gmb_posts
        WHERE client_id=? AND status<>'DELETED' AND published_at BETWEEN ? AND ?
        ORDER BY published_at DESC LIMIT 40`,
      [clientId, `${iso(start)} 00:00:00`, `${iso(end)} 23:59:59`],
    ),
  ]);

  const profile = settled(profileR, null) || {};
  const rank = await one(
    "SELECT keyword, grid_size, spacing_km, avg_rank, top3_pct, found_pct, competitors, created_at, is_sample FROM rank_scans WHERE client_id=? AND status='DONE' ORDER BY id DESC LIMIT 1",
    [clientId],
  ).catch(() => null);
  const cur = settled(curR, { series: [], source: "none" });
  const prev = settled(prevR, { series: [] });
  const totals = sumSeries(cur.series);
  const prevTotals = sumSeries(prev.series);
  const deltas = Object.fromEntries([...METRICS, "actions"].map((k) => [k, change(totals[k], prevTotals[k])]));

  // weekday pattern
  const wd = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
  for (const r of cur.series) {
    const d = new Date(`${r.stat_date}T00:00:00`).getDay();
    wd[d].sum += Number(r.views || 0);
    wd[d].n += 1;
  }
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, i) => ({ label, value: wd[i].n ? Math.round(wd[i].sum / wd[i].n) : 0 }));

  const rv = settled(reviewsR, null) || {};
  const items = rv.items || [];
  const replied = items.filter((r) => r.replied || r.reply?.comment).length;
  const distribution = [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: items.filter((r) => stars(r.rating) === s).length }));
  const inPeriod = items.filter((r) => r.created_at && new Date(r.created_at) >= start).length;
  const reviews = {
    average: Number(rv.average_rating || profile.rating || 0),
    total: Number(rv.total ?? profile.review_count ?? items.length),
    loaded: items.length,
    replied,
    unreplied: items.length - replied,
    responseRate: items.length ? Math.round((replied / items.length) * 100) : null,
    newInPeriod: inPeriod,
    distribution,
    recent: items.slice(0, 5).map((r) => ({ author: r.author, rating: stars(r.rating), comment: r.comment || "", replied: Boolean(r.replied || r.reply?.comment), date: r.created_at })),
    note: rv.note || null,
  };

  const keywords = (settled(keywordsR, null)?.keywords || []).slice(0, 12);
  const media = settled(mediaR, []) || [];
  const mediaByCat = media.reduce((a, m) => ({ ...a, [m.category || "ADDITIONAL"]: (a[m.category || "ADDITIONAL"] || 0) + 1 }), {});
  const posts = settled(postsR, []);

  const hoursSet = Boolean(profile.opening_hours?.periods?.length || Object.keys(profile.opening_hours || {}).length);
  const checklist = [
    ["Business description", Boolean(profile.description || client.description)],
    ["Phone number", Boolean(profile.phone || client.phone)],
    ["Website", Boolean(profile.website || client.website)],
    ["Opening hours", hoursSet],
    ["Services listed (3+)", (profile.services || []).length >= 3],
    ["Additional categories", (profile.additional_categories || []).length > 0],
    ["Cover & logo photos", Boolean(mediaByCat.COVER && (mediaByCat.PROFILE || mediaByCat.LOGO))],
    ["10+ photos", media.length >= 10],
    [`Posted in the last ${span} days`, posts.length > 0],
    ["All reviews answered", items.length > 0 && replied === items.length],
  ].map(([label, ok]) => ({ label, ok }));
  const health = Math.round((checklist.filter((c) => c.ok).length / checklist.length) * 100);

  const tips = [];
  if (reviews.unreplied > 0) tips.push(`Reply to ${reviews.unreplied} unanswered review${reviews.unreplied > 1 ? "s" : ""} - replies build trust and help ranking.`);
  if (posts.length < Math.ceil(span / 7)) tips.push(`Post at least once a week - only ${posts.length} post${posts.length === 1 ? "" : "s"} in this period.`);
  if (media.length < 10) tips.push("Add fresh photos (interior, team, work in progress) - aim for 10+ and add new ones monthly.");
  if (!(profile.description || client.description)) tips.push("Add a 600-750 character description with main services and area.");
  if ((profile.services || []).length < 3) tips.push("List every service you offer - it widens the searches you appear in.");
  if (deltas.views !== null && deltas.views < 0) tips.push(`Views dropped ${Math.abs(deltas.views)}% vs the previous period - increase posting and photo updates.`);
  const busiest = [...weekdays].sort((a, b) => b.value - a.value)[0];
  if (busiest?.value) tips.push(`${busiest.label} gets the most views - schedule offers and posts for that day.`);
  if (keywords[0]) tips.push(`Top search term is "${keywords[0].keyword}" - use it in the next posts and description.`);

  return {
    client,
    profile,
    period: { days: span, start: iso(start), end: iso(end), prevStart: iso(prevStart), prevEnd: iso(prevEnd) },
    series: cur.series,
    source: cur.source,
    totals,
    prevTotals,
    deltas,
    weekdays,
    reviews,
    keywords,
    media: { total: media.length, byCategory: mediaByCat },
    posts,
    checklist,
    health,
    tips: tips.slice(0, 7),
    rank: rank && !rank.is_sample
      ? { keyword: rank.keyword, grid: `${rank.grid_size}x${rank.grid_size}`, spacing: Number(rank.spacing_km), avg: Number(rank.avg_rank), top3: rank.top3_pct, found: rank.found_pct, at: rank.created_at, competitors: JSON.parse(rank.competitors || "[]").slice(0, 5) }
      : null,
    generatedAt: new Date().toISOString(),
    // legacy fields used by the email template
    days: span,
  };
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(report) {
  const lines = [
    `GMB performance report - ${report.client.business_name}`,
    `Period: ${report.period.start} to ${report.period.end}`,
    `Data source: ${report.source}`,
    "",
    ["date", "views", "search_views", "maps_views", "clicks", "calls", "direction_requests"].join(","),
  ];
  for (const r of report.series) {
    lines.push([r.stat_date, r.views, r.search_views ?? "", r.maps_views ?? "", r.clicks, r.calls, r.direction_requests || 0].map(csvEscape).join(","));
  }
  const t = report.totals;
  lines.push(["TOTAL", t.views, t.search_views, t.maps_views, t.clicks, t.calls, t.direction_requests].map(csvEscape).join(","));
  lines.push("", ["post_title", "type", "status", "published_at"].join(","));
  for (const p of report.posts) lines.push([p.title, p.post_type, p.status, p.published_at ? new Date(p.published_at).toISOString() : ""].map(csvEscape).join(","));
  return lines.join("\n");
}

export function reportFilename(report, ext = "pdf") {
  const slug = report.client.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `gmb-report-${slug}-${report.period.end}.${ext}`;
}
