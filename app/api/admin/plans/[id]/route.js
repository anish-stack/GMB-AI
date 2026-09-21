import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { getPlan, savePlan, deletePlan } from "@/lib/saas/billing.js";
import { audit } from "@/lib/saas/audit.js";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;
  const plan = await getPlan(Number(id));
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function PATCH(request, { params }) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    const body = await request.json();
    body.slug = body.slug ? slugify(body.slug) : slugify(body.name);
    await savePlan(body, Number(id));
    await audit(g.ctx, "ADMIN_PLAN_UPDATED", { entity: "plan", entityId: Number(id) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request, { params }) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    const result = await deletePlan(Number(id));
    await audit(g.ctx, "ADMIN_PLAN_DELETED", { entity: "plan", entityId: Number(id), meta: result });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return apiError(err);
  }
}
