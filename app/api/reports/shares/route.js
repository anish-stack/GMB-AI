import { NextResponse } from "next/server";
import { guard } from "@/lib/saas/guard.js";
import { listShares } from "@/lib/reports/share.js";

export const dynamic = "force-dynamic";

/** GET ?client_id=&method=&q=&page= -> this tenant's report sharing history. */
export async function GET(request) {
  const g = await guard(request, { permission: "gmb.view" });
  if (g.error) return g.error;
  const sp = new URL(request.url).searchParams;
  const page = Math.max(parseInt(sp.get("page"), 10) || 1, 1);
  const data = await listShares(g.ctx.tenantId, { clientId: sp.get("client_id"), method: sp.get("method"), q: (sp.get("q") || "").slice(0, 80), limit: 25, offset: (page - 1) * 25 });
  return NextResponse.json({ ok: true, page, ...data });
}
