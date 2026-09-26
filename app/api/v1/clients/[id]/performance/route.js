import { publicApi, notFound, badRequest } from "@/lib/api/public.js";
import { one } from "@/lib/db";
import { providerFor } from "@/lib/gmb/provider";

export const dynamic = "force-dynamic";

/** GET /api/v1/clients/:id/performance?days=30 (7-365) */
export const GET = publicApi({ scope: "reports:read", endpoint: "reports.performance" }, async ({ request, params, tenantId }) => {
  const days = parseInt(new URL(request.url).searchParams.get("days") || "30", 10);
  if (!(days >= 7 && days <= 365)) throw badRequest("days must be between 7 and 365");
  const c = await one("SELECT id FROM clients WHERE id=? AND tenant_id=?", [Number(params.id), tenantId]);
  if (!c) throw notFound("Client not found");
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  const r = await (await providerFor(c.id)).getPerformance(c.id, { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) });
  const series = (r.series || []).map((x) => ({
    date: x.stat_date, views: Number(x.views || 0), search_views: Number(x.search_views || 0), maps_views: Number(x.maps_views || 0),
    website_clicks: Number(x.clicks || 0), calls: Number(x.calls || 0), directions: Number(x.direction_requests || 0),
  }));
  const sum = (k) => series.reduce((s, x) => s + x[k], 0);
  return { days, is_sample_data: Boolean(r.is_mock), totals: { views: sum("views"), website_clicks: sum("website_clicks"), calls: sum("calls"), directions: sum("directions") }, series };
});
