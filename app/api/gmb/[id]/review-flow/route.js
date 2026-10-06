import { route } from "@/lib/saas/routeKit.js";
import { query } from "@/lib/db";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { getFlow, saveFlow, matchGoogleReviews } from "@/lib/reviews/flow.js";
import { listingLinks } from "@/lib/gmb/links.js";

export const dynamic = "force-dynamic";

export const GET = route({ permission: "gmb.view" }, async ({ ctx, params }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  await matchGoogleReviews(id).catch(() => 0);
  const [flow, links, feedback, stats] = await Promise.all([
    getFlow(id),
    listingLinks(id),
    query("SELECT id, kind, status, rating, answers, message, name, contact, lang, matched_at, created_at FROM review_feedback WHERE client_id=? ORDER BY id DESC LIMIT 100", [id]),
    query("SELECT kind, status, COUNT(*) n FROM review_feedback WHERE client_id=? GROUP BY kind, status", [id]),
  ]);
  const count = (k, st) => stats.filter((x) => x.kind === k && (!st || x.status === st)).reduce((a, x) => a + Number(x.n), 0);
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  return {
    flow, links, feedback,
    collected: { written: count("GOOGLE"), live: count("GOOGLE", "LIVE_ON_GOOGLE"), private: count("PRIVATE") },
    flowUrl: `${base}/review/${flow.slug}`,
  };
});

/** PUT { mode, steps, poster, threshold } */
export const PUT = route({ permission: "gmb.edit" }, async ({ ctx, params, request }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  return { flow: await saveFlow(id, await request.json().catch(() => ({}))) };
});