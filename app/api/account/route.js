import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { changePassword } from "@/lib/auth";
import { update } from "@/lib/db";
import { updateTenant } from "@/lib/saas/tenants.js";
import { assertCan } from "@/lib/saas/rbac.js";

export const dynamic = "force-dynamic";

/** body.action: profile | password | workspace */
export async function PATCH(request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const { ctx } = g;
  try {
    const body = await request.json();

    if (body.action === "password") {
      await changePassword(ctx.userId, body.current_password, body.new_password);
      return NextResponse.json({ ok: true, message: "Password updated" });
    }

    if (body.action === "workspace") {
      assertCan(ctx, "settings.edit");
      await updateTenant(ctx.tenantId, body);
      return NextResponse.json({ ok: true, message: "Workspace updated" });
    }

    const patch = {};
    if (body.name) patch.name = body.name;
    if (body.phone !== undefined) patch.phone = body.phone;
    if (Object.keys(patch).length) await update("users", ctx.userId, patch);
    return NextResponse.json({ ok: true, message: "Profile updated" });
  } catch (err) {
    return apiError(err);
  }
}
