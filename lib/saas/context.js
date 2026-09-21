import "server-only";
import { getSession, requireSession } from "../auth.js";
import { resolveEntitlements } from "./entitlements.js";
import { can } from "./rbac.js";
import { ROLES } from "./constants.js";

/**
 * One object every server component / route handler uses.
 * Super admin: tenantId = null (no row filter -> sees everything).
 */
export async function getContext() {
  const session = await getSession();
  if (!session) return null;
  const base = {
    session,
    userId: session.id,
    name: session.name,
    role: session.role,
    tenantId: session.tenantId || null,
    employeeId: session.employeeId || null,
    isSuperAdmin: session.role === ROLES.SUPER_ADMIN,
    impersonating: session.impersonatedBy || null,
    can: (p) => can(session.role, p),
  };
  if (!base.tenantId) return { ...base, ent: null };
  const ent = await resolveEntitlements(base.tenantId);
  return { ...base, ent, tenant: ent.tenant, plan: ent.plan, limits: ent.limits, features: ent.features };
}

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
