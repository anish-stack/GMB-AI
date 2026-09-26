import { route } from "@/lib/saas/routeKit.js";
import { listInbox, syncReviews, draftReply } from "@/lib/reviews/inbox.js";
import { assertUserRate } from "@/lib/api/rateLimiter.js";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET ?status=UNREPLIED|REPLIED|IGNORED|ALL&client=&max_stars=&q=&page= */
export const GET = route({ permission: "gmb.view" }, async ({ ctx, request }) => {
  const sp = new URL(request.url).searchParams;
  const page = Math.max(parseInt(sp.get("page"), 10) || 1, 1);
  return {
    page,
    ...(await listInbox(ctx.tenantId, {
      status: sp.get("status") || "UNREPLIED", clientId: sp.get("client") || null, maxStars: sp.get("max_stars") || null,
      q: (sp.get("q") || "").slice(0, 80), limit: 30, offset: (page - 1) * 30,
    })),
  };
});

/** POST { action: "sync" } | { action: "draft_all" } */
export const POST = route({ permission: "gmb.edit" }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  if (b.action === "sync") {
    await assertUserRate(ctx.userId, "review-sync", 4, 300);
    return { result: await syncReviews({ tenantId: ctx.tenantId }) };
  }
  if (b.action === "draft_all") {
    await assertUserRate(ctx.userId, "review-draft-all", 3, 600);
    const rows = await query("SELECT id, rating FROM review_inbox WHERE tenant_id=? AND status='UNREPLIED' AND ai_draft IS NULL ORDER BY rating, review_created_at DESC LIMIT 20", [ctx.tenantId]);
    let drafted = 0;
    for (const r of rows) {
      try {
        await draftReply(r.id, { tenantId: ctx.tenantId, tone: r.rating && r.rating <= 2 ? "apologetic" : "professional" });
        drafted += 1;
      } catch { /* continue */ }
    }
    return { drafted };
  }
  throw Object.assign(new Error("Unknown action"), { status: 400 });
});
