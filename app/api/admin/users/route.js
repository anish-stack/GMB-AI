import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { query, insert, update, one } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ROLES } from "@/lib/saas/constants.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  return NextResponse.json({
    users: await query(
      `SELECT u.id,u.name,u.email,u.role,u.active,u.last_login_at,u.created_at,t.name AS tenant_name
         FROM users u LEFT JOIN tenants t ON t.id=u.tenant_id ORDER BY u.id`
    ),
  });
}

/** Create another platform super admin. */
export async function POST(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!body.name || !email || !body.password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (await one("SELECT id FROM users WHERE email=?", [email])) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }
    const id = await insert("users", {
      tenant_id: null,
      name: body.name,
      email,
      password_hash: await hashPassword(body.password),
      role: ROLES.SUPER_ADMIN,
      active: 1,
    });
    await audit(g.ctx, "ADMIN_USER_CREATED", { entity: "user", entityId: id });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  try {
    const body = await request.json();
    const patch = {};
    if (body.active !== undefined) patch.active = body.active ? 1 : 0;
    if (body.name) patch.name = body.name;
    if (body.password) patch.password_hash = await hashPassword(body.password);
    if (Object.keys(patch).length) await update("users", Number(body.id), patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
