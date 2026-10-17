import { PERMISSIONS, ROLES, ForbiddenError } from "./constants.js";

/** role-only check (custom per-member permissions live on the context: ctx.perms). */
export function can(role, permission, perms = null) {
  if (role === ROLES.SUPER_ADMIN) return true;
  const list = Array.isArray(perms) ? perms : PERMISSIONS[role] || [];
  return list.includes(permission);
}

export function assertCan(ctxOrRole, permission) {
  const role = typeof ctxOrRole === "string" ? ctxOrRole : ctxOrRole?.role;
  const perms = typeof ctxOrRole === "string" ? null : ctxOrRole?.perms;
  if (!can(role, permission, perms)) {
    throw new ForbiddenError(`You don't have access to this (${permission}). Ask the workspace owner to enable it in Team -> Permissions.`);
  }
  return true;
}

export function isSuperAdmin(ctxOrRole) {
  const role = typeof ctxOrRole === "string" ? ctxOrRole : ctxOrRole?.role;
  return role === ROLES.SUPER_ADMIN;
}

export function isTenantAdmin(ctxOrRole) {
  const role = typeof ctxOrRole === "string" ? ctxOrRole : ctxOrRole?.role;
  return role === ROLES.OWNER;
}
