import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { providerFor } from "@/lib/gmb/provider";
import { buildKnowledge } from "@/lib/repo/knowledge.js";
import { runReviewReplyAgent } from "@/lib/ai/agents/reviewReply.js";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;

  const { id, reviewId } = await params;
  const clientId = Number(id);

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);

    const body = await request.json().catch(() => ({}));
    const provider = await providerFor(clientId);

    const [review, kb] = await Promise.all([
      provider.getReview(clientId, reviewId),
      buildKnowledge(clientId).catch(() => null),
    ]);

    const draft = await runReviewReplyAgent(
      {
        business: kb?.business || null,
        category: kb?.category || null,
        city: kb?.city || null,
        services: kb?.services || [],
        prohibited: kb?.prohibited_claims || [],
        reviewer: review.author || null,
        rating: review.rating,
        comment: review.comment,
      },
      body.tone || "professional",
      { clientId, taskId: null },
    );

    // Draft only - publishing happens via a separate, explicit POST .../reply call.
    return NextResponse.json({ ok: true, ...draft });
  } catch (err) {
    return apiError(err);
  }
}
