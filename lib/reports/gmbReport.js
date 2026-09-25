import "server-only";
import { one, query } from "../db.js";
import { getGMBProvider } from "../gmb/provider.js";

/**
 * Builds the "past performance" report for one client's connected GMB profile.
 *
 * Data source: this always tries the LIVE provider first (real Google numbers
 * via GoogleGMBProvider.getPerformance -> Business Profile Performance API,
 * see lib/gmb/googleProvider.js). If that call fails (not yet approved for
 * API access, token expired, etc.) it falls back to whatever is already
 * cached in gmb_performance (populated by /api/gmb/sync's cachePerformance())
 * so the report/email still goes out instead of hard failing.
 */
export async function buildGmbReport(clientId, days = 30) {
  const client = await one(
    "SELECT id, business_name, city, google_email, gmb_connection_status FROM clients WHERE id=?",
    [clientId]
  );
  if (!client) throw new Error(`Client ${clientId} not found`);

  const provider = getGMBProvider();
  let series = [];
  let source = "cache";
  try {
    const live = await provider.getPerformance(clientId, days);
    series = live.series || [];
    source = live.is_mock ? "mock" : "google_live";
  } catch (err) {
    const rows = await query(
      `SELECT stat_date, views, clicks, calls, direction_requests
         FROM gmb_performance WHERE client_id=? ORDER BY stat_date ASC
         LIMIT 540`,
      [clientId]
    );
    series = rows.map((r) => ({ ...r, stat_date: String(r.stat_date).slice(0, 10) }));
    source = rows.length ? "cache_fallback" : "none";
    if (!rows.length) throw new Error(`No performance data available yet (live fetch failed: ${err.message}). Run "Sync" on this client first.`);
  }

  const posts = await query(
    `SELECT title, post_type, status, published_at FROM gmb_posts
      WHERE client_id=? ORDER BY COALESCE(published_at, created_at) DESC LIMIT 200`,
    [clientId]
  );

  const totals = series.reduce(
    (acc, r) => ({
      views: acc.views + Number(r.views || 0),
      clicks: acc.clicks + Number(r.clicks || 0),
      calls: acc.calls + Number(r.calls || 0),
      direction_requests: acc.direction_requests + Number(r.direction_requests || 0),
    }),
    { views: 0, clicks: 0, calls: 0, direction_requests: 0 }
  );

  return { client, series, posts, totals, source, days };
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Two sections in one CSV: daily performance, then recent posts - opens fine in Excel/Sheets. */
export function reportToCsv(report) {
  const lines = [];
  lines.push(`GMB performance report - ${report.client.business_name}`);
  lines.push(`Period: last ${report.days} days`);
  lines.push(`Data source: ${report.source}`);
  lines.push("");
  lines.push(["date", "views", "clicks", "calls", "direction_requests"].join(","));
  for (const r of report.series) {
    lines.push([r.stat_date, r.views, r.clicks, r.calls, r.direction_requests || 0].map(csvEscape).join(","));
  }
  lines.push("");
  lines.push(["TOTAL", report.totals.views, report.totals.clicks, report.totals.calls, report.totals.direction_requests].map(csvEscape).join(","));
  lines.push("");
  lines.push(["post_title", "type", "status", "published_at"].join(","));
  for (const p of report.posts) {
    lines.push([p.title, p.post_type, p.status, p.published_at ? new Date(p.published_at).toISOString() : ""].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export function reportFilename(report) {
  const slug = report.client.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `gmb-report-${slug}-${date}.csv`;
}
