import { NextResponse } from "next/server";
import { getContext } from "./context.js";
import { assertCan } from "./rbac.js";
import { ROLES } from "./constants.js";

/**
 * API route guard.
 *   const g = await guard(request, { permission: "client.create" });
 *   if (g.error) return g.error;
 *   const ctx = g.ctx;
 */
export async function guard(_request, { permission = null, superAdmin = false } = {}) {
  const ctx = await getContext();
  if (!ctx) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  if (superAdmin && ctx.role !== ROLES.SUPER_ADMIN) {
    return { error: NextResponse.json({ error: "Super admin only" }, { status: 403 }) };
  }
  if (permission) {
    try {
      assertCan(ctx, permission);
    } catch (err) {
      return { error: NextResponse.json({ error: err.message, code: "FORBIDDEN" }, { status: 403 }) };
    }
  }
  return { ctx };
}

/** Converts QuotaError / ForbiddenError into the right HTTP status. */
export function apiError(err) {
  const status = err?.status || 500;
  return NextResponse.json(
    { error: err?.message || "Something went wrong", code: err?.code || "ERROR", meta: err?.meta || null },
    { status }
  );
}

/** Row-ownership check: a tenant user may only touch their own rows. */
export function scopeOf(ctx) {
  return ctx.isSuperAdmin && !ctx.tenantId ? null : ctx.tenantId;
}
