import "server-only";
import { cache } from "react";
import { getSession, requireSession } from "../auth.js";
import { resolveEntitlements } from "./entitlements.js";
import { can } from "./rbac.js";
import { ROLES, effectivePermissions } from "./constants.js";
import { one } from "../db.js";

/**
 * One object every server component / route handler uses.
 * Super admin: tenantId = null (no row filter -> sees everything).
 */
export const getContext = cache(async function getContext() {
  const t0 = Date.now();
  const session = await getSession();
  if (!session) return null;
  // per-member permissions are read fresh every request, so owner changes apply immediately
  const row = session.role === ROLES.SUPER_ADMIN || session.role === ROLES.OWNER ? null : await one("SELECT permissions FROM users WHERE id=?", [session.id]).catch(() => null);
  const perms = effectivePermissions(session.role, row?.permissions ?? null);
  const base = {
    session,
    perms,
    userId: session.id,
    name: session.name,
    role: session.role,
    tenantId: session.tenantId || null,
    employeeId: session.employeeId || null,
    isSuperAdmin: session.role === ROLES.SUPER_ADMIN,
    impersonating: session.impersonatedBy || null,
    can: (p) => can(session.role, p, perms),
  };
  if (!base.tenantId) return { ...base, ent: null };
  const t1 = Date.now();
  const ent = await resolveEntitlements(base.tenantId);
  // slow-request log: shows in `pm2 logs hbs-web` when the DB / CPU is the bottleneck
  const total = Date.now() - t0;
  if (total > 250) console.warn(`[slow-context] total=${total}ms entitlements=${Date.now() - t1}ms tenant=${base.tenantId}`);
  return { ...base, ent, tenant: ent.tenant, plan: ent.plan, limits: ent.limits, features: ent.features };
});

export async function requireContext() {
  await requireSession();
  return getContext();
}

/** Tenant-scoped context for the workspace pages. */
export async function requireTenantContext() {
  const ctx = await requireContext();
  if (!ctx.tenantId) {
    const { redirect } = await import("next/navigation");
    redirect("/admin");
  }
  return ctx;
}

/** Workspace page guard: no permission -> back to the dashboard with a notice. */
export async function requirePagePermission(permission) {
  const ctx = await requireTenantContext();
  if (!ctx.can(permission)) {
    const { redirect } = await import("next/navigation");
    redirect(`/dashboard?denied=${encodeURIComponent(permission)}`);
  }
  return ctx;
}