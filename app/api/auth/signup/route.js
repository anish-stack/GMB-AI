import { NextResponse } from "next/server";
import { provisionTenant } from "@/lib/saas/tenants.js";
import { getSettings } from "@/lib/saas/settings.js";
import { login } from "@/lib/auth";
import { apiError } from "@/lib/saas/guard.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const settings = await getSettings();
    if (Number(settings.allow_signup) !== 1) {
      return NextResponse.json({ error: "Self signup is disabled. Contact sales." }, { status: 403 });
    }

    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!body.company_name || !body.name || !email || !body.password) {
      return NextResponse.json({ error: "Company, name, email and password are required" }, { status: 400 });
    }
    if (String(body.password).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    await provisionTenant({
      companyName: body.company_name,
      ownerName: body.name,
      email,
      password: body.password,
      phone: body.phone || null,
      planSlug: body.plan_slug || settings.default_plan_slug || "free",
      billingCycle: body.billing_cycle === "YEARLY" ? "YEARLY" : "MONTHLY",
    });

    await login(email, body.password);
    return NextResponse.json({ ok: true, redirect: "/dashboard" });
  } catch (err) {
    return apiError(err);
  }
}
