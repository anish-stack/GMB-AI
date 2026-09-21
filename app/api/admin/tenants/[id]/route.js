import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { getTenant, updateTenant, setTenantStatus, deleteTenant } from "@/lib/saas/tenants.js";
import { changePlan, cancelSubscription, renewSubscription, setOverrides, extendPeriod } from "@/lib/saas/billing.js";
import { grantCredits } from "@/lib/saas/credits.js";
import { resolveEntitlements } from "@/lib/saas/entitlements.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;
  const tenant = await getTenant(Number(id));
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ tenant, entitlements: await resolveEntitlements(Number(id)) });
}

/**
 * body.action:
 *   update | suspend | activate | change-plan | extend | renew | cancel | overrides | grant-credits
 */
export async function PATCH(request, { params }) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;
  const tenantId = Number(id);
  const actor = g.ctx.name;

  try {
    const body = await request.json();
    switch (body.action) {
      case "suspend":
        await setTenantStatus(tenantId, "SUSPENDED", body.reason || "Suspended by admin", g.ctx);
        break;
      case "activate":
        await setTenantStatus(tenantId, "ACTIVE", null, g.ctx);
        break;
      case "change-plan":
        await changePlan({
          tenantId,
          planId: Number(body.plan_id),
          billingCycle: body.billing_cycle || null,
          actor,
          note: body.note || "Changed by super admin",
          resetCredits: body.reset_credits !== false,
        });
        break;
      case "extend":
        await extendPeriod({ tenantId, days: Number(body.days || 30), actor });
        break;
      case "renew":
        await renewSubscription({ tenantId, actor });
        break;
      case "cancel":
        await cancelSubscription({ tenantId, immediate: Boolean(body.immediate), actor, reason: body.reason });
        break;
      case "overrides":
        await setOverrides({ tenantId, overrides: body.overrides || {}, actor });
        break;
      case "grant-credits":
        await grantCredits(tenantId, Number(body.credits || 0), {
          bucket: body.bucket === "PLAN" ? "PLAN" : "PURCHASED",
          reason: "ADMIN_GRANT",
          note: body.note || `Granted by ${actor}`,
        });
        break;
      default:
        await updateTenant(tenantId, body);
    }
    await audit(g.ctx, `ADMIN_TENANT_${String(body.action || "UPDATE").toUpperCase()}`, {
      entity: "tenant",
      entityId: tenantId,
      meta: body,
    });
    return NextResponse.json({ ok: true, tenant: await getTenant(tenantId) });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request, { params }) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    await deleteTenant(Number(id));
    await audit(g.ctx, "ADMIN_TENANT_DELETED", { entity: "tenant", entityId: Number(id) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
