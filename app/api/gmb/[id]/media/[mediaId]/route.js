import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { providerFor } from "@/lib/gmb/provider";

export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;

  const { id, mediaId } = await params;
  const clientId = Number(id);

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);
    const provider = await providerFor(clientId);
    await provider.deleteMedia(clientId, decodeURIComponent(mediaId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
