import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { listTenants, provisionTenant } from "@/lib/saas/tenants.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    tenants: await listTenants({
      search: searchParams.get("q") || null,
      status: searchParams.get("status") || null,
    }),
  });
}

export async function POST(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  try {
    const body = await request.json();
    if (!body.company_name || !body.owner_name || !body.email || !body.password) {
      return NextResponse.json({ error: "Company, owner name, email and password are required" }, { status: 400 });
    }
    const result = await provisionTenant({
      companyName: body.company_name,
      ownerName: body.owner_name,
      email: String(body.email).trim().toLowerCase(),
      password: body.password,
      phone: body.phone || null,
      planId: body.plan_id ? Number(body.plan_id) : null,
      billingCycle: body.billing_cycle === "YEARLY" ? "YEARLY" : "MONTHLY",
      trialDays: body.trial_days === undefined ? null : Number(body.trial_days),
      actor: g.ctx.name,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return apiError(err);
  }
}
