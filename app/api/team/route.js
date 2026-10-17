import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { listTenantUsers, hashPassword } from "@/lib/auth";
import { insert, one } from "@/lib/db";
import { assertLimit } from "@/lib/saas/entitlements.js";
import { TENANT_ROLES, ROLES, ALL_TENANT_PERMISSIONS } from "@/lib/saas/constants.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { permission: "team.view" });
  if (g.error) return g.error;
  return NextResponse.json({ users: await listTenantUsers(g.ctx.tenantId) });
}

export async function POST(request) {
  const g = await guard(request, { permission: "team.invite" });
  if (g.error) return g.error;
  const { ctx } = g;
  try {
    assertLimit(ctx.ent, "max_team_members", 1);
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!body.name || !email || !body.password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (!TENANT_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    // only an owner can create another owner or hand out a custom permission set
    if (ctx.role !== ROLES.OWNER && (body.role === ROLES.OWNER || Array.isArray(body.permissions))) {
      return NextResponse.json({ error: "Only the workspace owner can add owners or set permissions" }, { status: 403 });
    }
    const permissions = body.role !== ROLES.OWNER && Array.isArray(body.permissions)
      ? JSON.stringify(body.permissions.filter((p) => ALL_TENANT_PERMISSIONS.includes(p)))
      : null;
    if (await one("SELECT id FROM users WHERE email=?", [email])) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    const userId = await insert("users", {
      tenant_id: ctx.tenantId,
      name: body.name,
      email,
      phone: body.phone || null,
      password_hash: await hashPassword(body.password),
      role: body.role,
      permissions,
      active: 1,
    });
    await insert("employees", {
      tenant_id: ctx.tenantId,
      user_id: userId,
      department: body.department || "SEO",
      capacity: Number(body.capacity || 40),
    });
    await audit(ctx, "TEAM_MEMBER_ADDED", { entity: "user", entityId: userId, meta: { role: body.role } });
    return NextResponse.json({ ok: true, id: userId });
  } catch (err) {
    return apiError(err);
  }
}
