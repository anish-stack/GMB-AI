import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { listPlans, savePlan } from "@/lib/saas/billing.js";
import { audit } from "@/lib/saas/audit.js";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  return NextResponse.json({ plans: await listPlans({ activeOnly: false }) });
}

export async function POST(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  try {
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: "Plan name is required" }, { status: 400 });
    body.slug = body.slug ? slugify(body.slug) : slugify(body.name);
    const id = await savePlan(body);
    await audit(g.ctx, "ADMIN_PLAN_CREATED", { entity: "plan", entityId: id, meta: { name: body.name } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return apiError(err);
  }
}
