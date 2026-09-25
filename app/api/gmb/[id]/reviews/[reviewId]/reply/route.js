import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { getGMBProvider } from "@/lib/gmb/provider";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;

  const { id, reviewId } = await params;
  const clientId = Number(id);

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);
    const body = await request.json();
    const provider = getGMBProvider();
    const result = await provider.replyToReview(clientId, reviewId, body.reply);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;

  const { id, reviewId } = await params;
  const clientId = Number(id);

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);
    const provider = getGMBProvider();
    await provider.deleteReviewReply(clientId, reviewId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
