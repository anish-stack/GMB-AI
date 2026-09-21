import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { impersonate, stopImpersonation, getSession } from "@/lib/auth";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  try {
    const { tenantId } = await request.json();
    const session = await impersonate(Number(tenantId));
    await audit(g.ctx, "ADMIN_IMPERSONATE", { entity: "tenant", entityId: Number(tenantId) });
    return NextResponse.json({ ok: true, as: session.name, redirect: "/dashboard" });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE() {
  const current = await getSession();
  if (!current?.impersonatedBy) {
    return NextResponse.json({ error: "Not impersonating" }, { status: 400 });
  }
  try {
    await stopImpersonation();
    return NextResponse.json({ ok: true, redirect: "/admin" });
  } catch (err) {
    return apiError(err);
  }
}
