import { route } from "@/lib/saas/routeKit.js";
import { draftReply, publishReply, setIgnored } from "@/lib/reviews/inbox.js";
import { assertUserRate } from "@/lib/api/rateLimiter.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { action: "draft", tone } | { action: "publish", text } | { action: "ignore" | "unignore" } */
export const POST = route({ permission: "gmb.edit" }, async ({ ctx, request, params }) => {
  const b = await request.json().catch(() => ({}));
  if (b.action === "draft") {
    await assertUserRate(ctx.userId, "review-draft", 20, 60);
    return await draftReply(params.id, { tenantId: ctx.tenantId, tone: b.tone || "professional" });
  }
  if (b.action === "publish") {
    const item = await publishReply(params.id, { tenantId: ctx.tenantId, text: b.text, actor: ctx.name });
    await audit(ctx, "REVIEW_REPLIED", { entity: "client", entityId: item.client_id, meta: { inbox_id: item.id, rating: item.rating } });
    return { item };
  }
  if (b.action === "ignore" || b.action === "unignore") return { item: await setIgnored(params.id, { tenantId: ctx.tenantId, ignored: b.action === "ignore" }) };
  throw Object.assign(new Error("Unknown action"), { status: 400 });
});
