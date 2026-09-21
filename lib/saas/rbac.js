import { PERMISSIONS, ROLES, ForbiddenError } from "./constants.js";

export function can(role, permission) {
  if (role === ROLES.SUPER_ADMIN) return true;
  const list = PERMISSIONS[role] || [];
  return list.includes(permission);
}

export function assertCan(ctxOrRole, permission) {
  const role = typeof ctxOrRole === "string" ? ctxOrRole : ctxOrRole?.role;
  if (!can(role, permission)) {
    throw new ForbiddenError(`Your role (${role || "unknown"}) cannot perform: ${permission}`);
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
