import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { hashPassword } from "@/lib/auth";
import { one, update, query } from "@/lib/db";
import { TENANT_ROLES, ROLES, ALL_TENANT_PERMISSIONS } from "@/lib/saas/constants.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

async function assertMember(id, tenantId) {
  const user = await one("SELECT * FROM users WHERE id=? AND tenant_id=?", [id, tenantId]);
  if (!user) {
    const err = new Error("Team member not found");
    err.status = 404;
    throw err;
  }
  return user;
}

export async function PATCH(request, { params }) {
  const g = await guard(request, { permission: "team.edit" });
  if (g.error) return g.error;
  const { ctx } = g;
  const { id } = await params;
  try {
    const user = await assertMember(Number(id), ctx.tenantId);
    const body = await request.json();
    const patch = {};
    if (body.name) patch.name = body.name;
    if (body.phone !== undefined) patch.phone = body.phone;
    if (body.password) patch.password_hash = await hashPassword(body.password);
    const isOwner = ctx.role === ROLES.OWNER;
    // non-owners (even with team.edit) can't touch owners, roles or permissions
    if (!isOwner && (user.role === ROLES.OWNER || body.role || body.permissions !== undefined)) {
      return NextResponse.json({ error: "Only the workspace owner can change roles, permissions or owner accounts" }, { status: 403 });
    }
    if (body.permissions !== undefined) {
      if (user.role === ROLES.OWNER) return NextResponse.json({ error: "Owners always have full access" }, { status: 400 });
      patch.permissions = body.permissions === null ? null : JSON.stringify((Array.isArray(body.permissions) ? body.permissions : []).filter((p) => ALL_TENANT_PERMISSIONS.includes(p)));
    }
    if (body.role && TENANT_ROLES.includes(body.role)) {
      if (user.role === ROLES.OWNER && body.role !== ROLES.OWNER) {
        const owners = await one("SELECT COUNT(*) AS n FROM users WHERE tenant_id=? AND role='OWNER' AND active=1", [ctx.tenantId]);
        if (Number(owners.n) <= 1) {
          return NextResponse.json({ error: "The workspace must keep at least one owner" }, { status: 400 });
        }
      }
      patch.role = body.role;
    }
    if (body.active !== undefined) patch.active = body.active ? 1 : 0;
    if (Object.keys(patch).length) await update("users", Number(id), patch);

    if (body.department !== undefined || body.capacity !== undefined) {
      const emp = await one("SELECT id FROM employees WHERE user_id=?", [Number(id)]);
      if (emp) {
        await update("employees", emp.id, {
          ...(body.department !== undefined ? { department: body.department } : {}),
          ...(body.capacity !== undefined ? { capacity: Number(body.capacity) } : {}),
        });
      }
    }
    await audit(ctx, body.permissions !== undefined ? "TEAM_PERMISSIONS_CHANGED" : "TEAM_MEMBER_UPDATED", { entity: "user", entityId: Number(id), meta: body.permissions !== undefined ? { count: Array.isArray(body.permissions) ? body.permissions.length : "default" } : undefined });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request, { params }) {
  const g = await guard(request, { permission: "team.remove" });
  if (g.error) return g.error;
  const { ctx } = g;
  const { id } = await params;
  try {
    const user = await assertMember(Number(id), ctx.tenantId);
    if (Number(id) === ctx.userId) {
      return NextResponse.json({ error: "You cannot remove your own account" }, { status: 400 });
    }
    if (user.role === ROLES.OWNER && ctx.role !== ROLES.OWNER) {
      return NextResponse.json({ error: "Only an owner can remove an owner" }, { status: 403 });
    }
    if (user.role === ROLES.OWNER) {
      const owners = await one("SELECT COUNT(*) AS n FROM users WHERE tenant_id=? AND role='OWNER' AND active=1", [ctx.tenantId]);
      if (Number(owners.n) <= 1) {
        return NextResponse.json({ error: "The workspace must keep at least one owner" }, { status: 400 });
      }
    }
    await query("DELETE FROM users WHERE id=?", [Number(id)]);
    await audit(ctx, "TEAM_MEMBER_REMOVED", { entity: "user", entityId: Number(id) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
