import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { planUsage, savePlan, extendPlan } from "@/lib/posting/plan.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

async function load(request, params, permission) {
  const g = await guard(request, { permission });
  if (g.error) return { error: g.error };
  const { id } = await params;
  const clientId = Number(id);
  await assertClientInTenant(clientId, g.ctx.tenantId);
  return { ctx: g.ctx, clientId };
}

export async function GET(request, { params }) {
  try {
    const r = await load(request, params, "client.view");
    if (r.error) return r.error;
    return NextResponse.json({ ok: true, ...(await planUsage(r.clientId)) });
  } catch (err) {
    return apiError(err);
  }
}

/** PUT { start_date, duration_months, posts_per_week, total_posts?, posting_days? } */
export async function PUT(request, { params }) {
  try {
    const r = await load(request, params, "client.edit");
    if (r.error) return r.error;
    const body = await request.json().catch(() => ({}));
    const plan = await savePlan(r.clientId, r.ctx.tenantId, body, r.ctx.name);
    await audit(r.ctx, "CLIENT_PLAN_CHANGED", { entity: "client", entityId: r.clientId, meta: { posts_per_week: plan.posts_per_week, total: plan.total_posts, end: plan.end_date } });
    return NextResponse.json({ ok: true, ...(await planUsage(r.clientId)) });
  } catch (err) {
    return apiError(err);
  }
}

/** POST { action: "extend", months } */
export async function POST(request, { params }) {
  try {
    const r = await load(request, params, "client.edit");
    if (r.error) return r.error;
    const body = await request.json().catch(() => ({}));
    if (body.action !== "extend") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    await extendPlan(r.clientId, body.months, r.ctx.name);
    await audit(r.ctx, "CLIENT_PLAN_EXTENDED", { entity: "client", entityId: r.clientId, meta: { months: body.months } });
    return NextResponse.json({ ok: true, ...(await planUsage(r.clientId)) });
  } catch (err) {
    return apiError(err);
  }
}
