import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { one, query, update } from "./db.js";
import { ROLES } from "./saas/constants.js";

const COOKIE = "gmb_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  return process.env.SESSION_SECRET || "dev-insecure-secret";
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (data.exp && data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

async function setCookie(session) {
  const store = await cookies();
  store.set(COOKIE, sign(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

async function buildSession(user, extra = {}) {
  const employee = await one("SELECT id FROM employees WHERE user_id=?", [user.id]);
  const tenant = user.tenant_id
    ? await one("SELECT id,name,slug,status,logo_url,brand_color FROM tenants WHERE id=?", [user.tenant_id])
    : null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenant_id || null,
    tenantName: tenant?.name || null,
    tenantSlug: tenant?.slug || null,
    tenantStatus: tenant?.status || null,
    employeeId: employee ? employee.id : null,
    exp: Date.now() + MAX_AGE * 1000,
    ...extra,
  };
}

export async function login(email, password) {
  const user = await one("SELECT * FROM users WHERE email=? AND active=1", [email]);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;

  if (user.tenant_id) {
    const tenant = await one("SELECT status FROM tenants WHERE id=?", [user.tenant_id]);
    if (!tenant) return null;
    if (tenant.status === "CANCELLED") return { blocked: "This account has been closed. Contact support." };
  }

  await update("users", user.id, { last_login_at: new Date() });
  const session = await buildSession(user);
  await setCookie(session);
  return session;
}

export async function logout() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  return verify(token);
}

export async function requireSession() {
  const s = await getSession();
  if (!s) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return s;
}

/** Pages under /admin: platform owner only. */
export async function requireSuperAdmin() {
  const s = await requireSession();
  if (s.role !== ROLES.SUPER_ADMIN) {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }
  return s;
}

/** Pages under (app): must belong to a tenant. Super admin gets redirected to /admin. */
export async function requireTenantSession() {
  const s = await requireSession();
  if (!s.tenantId) {
    const { redirect } = await import("next/navigation");
    redirect("/admin");
  }
  return s;
}

/** Super admin "view as tenant". Original identity is kept so it can be restored. */
export async function impersonate(tenantId) {
  const current = await getSession();
  if (!current || current.role !== ROLES.SUPER_ADMIN) throw new Error("Only the super admin can impersonate");
  const owner = await one(
    "SELECT * FROM users WHERE tenant_id=? AND active=1 ORDER BY FIELD(role,'OWNER','MANAGER','MEMBER'), id LIMIT 1",
    [tenantId]
  );
  if (!owner) throw new Error("This tenant has no active user");
  const session = await buildSession(owner, {
    impersonatedBy: { id: current.id, name: current.name, email: current.email },
  });
  await setCookie(session);
  return session;
}

export async function stopImpersonation() {
  const current = await getSession();
  if (!current?.impersonatedBy) throw new Error("Not impersonating");
  const admin = await one("SELECT * FROM users WHERE id=?", [current.impersonatedBy.id]);
  if (!admin) throw new Error("Original admin account not found");
  const session = await buildSession(admin);
  await setCookie(session);
  return session;
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export async function changePassword(userId, currentPw, newPw) {
  const user = await one("SELECT * FROM users WHERE id=?", [userId]);
  if (!user) throw new Error("User not found");
  const ok = await bcrypt.compare(currentPw, user.password_hash);
  if (!ok) throw new Error("Current password is incorrect");
  await update("users", userId, { password_hash: await bcrypt.hash(newPw, 10) });
  return true;
}

export async function listTenantUsers(tenantId) {
  return query(
    `SELECT u.id,u.name,u.email,u.phone,u.role,u.active,u.last_login_at,u.created_at,
            e.id AS employee_id, e.department, e.capacity,
            (SELECT COUNT(*) FROM clients c WHERE c.assigned_employee_id=e.id) AS clients
       FROM users u LEFT JOIN employees e ON e.user_id=u.id
      WHERE u.tenant_id=? ORDER BY FIELD(u.role,'OWNER','MANAGER','MEMBER'), u.name`,
    [tenantId]
  );
}
