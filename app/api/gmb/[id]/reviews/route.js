import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { providerFor } from "@/lib/gmb/provider";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const g = await guard(request, { permission: "gmb.view" });
  if (g.error) return g.error;

  const { id } = await params;
  const clientId = Number(id);

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);
    const provider = await providerFor(clientId);
    const reviews = await provider.getReviews(clientId);
    return NextResponse.json(
      { ok: true, ...reviews },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return apiError(err);
  }
}
