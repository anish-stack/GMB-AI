import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { getGMBProvider } from "@/lib/gmb/provider";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const g = await guard(request, { permission: "gmb.view" });
  if (g.error) return g.error;

  const { id } = await params;
  const clientId = Number(id);
  const sp = new URL(request.url).searchParams;

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);

    const provider = getGMBProvider();
    const result = await provider.getSearchKeywords(clientId, {
      startMonth: sp.get("startMonth") || null,
      endMonth: sp.get("endMonth") || null,
      pageToken: sp.get("pageToken") || null,
    });

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return apiError(err);
  }
}
