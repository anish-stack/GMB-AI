import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { GoogleGMBProvider } from "@/lib/gmb/googleProvider.js";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmb/:id/service-types
 *
 * Returns the client's primary Google category + the exact list of service
 * types Google allows for that category (serviceTypeId + displayName).
 *
 * WHY this exists: updateServices() used to guess a match via a hardcoded
 * SERVICE_ALIASES map ("seo" -> "job_type_id:search_engine_optimization" etc).
 * That only covers categories someone thought to add ahead of time - a new
 * client in a category nobody anticipated (restaurant, plumber, whatever)
 * would fail with "not supported by the Google category ...". No AI needed
 * to fix this: Google already tells you, per category, exactly which
 * service types it accepts (primaryCategory.serviceTypes). The frontend
 * should call this route and render THOSE as checkboxes/a select, then send
 * the chosen serviceTypeId(s) straight to updateServices() - that removes
 * the alias-guessing step (and the "not supported" error) entirely, for
 * every category, not just the ones in SERVICE_ALIASES.
 */
export async function GET(request, { params }) {
  const g = await guard(request, { permission: "gmb.view" });
  if (g.error) return g.error;

  const { id } = await params;
  const clientId = Number(id);

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);
    const provider = new GoogleGMBProvider();
    const data = await provider.getAvailableServiceTypes(clientId);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return apiError(err);
  }
}