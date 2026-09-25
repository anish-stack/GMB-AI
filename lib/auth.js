import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { one, query, update } from "./db.js";
import { ROLES } from "./saas/constants.js";
import { startOtpChallenge, verifyOtpChallenge } from "./otp.js";

const COOKIE = "gmb_session";
const MAX_AGE = 60 * 60 * 24 * 7;
const MAX_FAILED_ATTEMPTS = 6;
const LOCKOUT_MINUTES = 15;

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

/**
 * Password step only - does NOT create a session. Used internally by both
 * the OTP flow below and anywhere that still needs a same-request login
 * (e.g. right after signup, where the account was just proven by email+password
 * and OTP would be redundant friction).
 */
async function verifyCredentials(email, password) {
  const user = await one("SELECT * FROM users WHERE email=? AND active=1", [email]);
  if (!user) return { error: "Invalid email or password" };

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    return { error: `Too many failed attempts. Try again in ${mins} minute(s), or reset your password.` };
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const failed = (user.failed_login_count || 0) + 1;
    const patch = { failed_login_count: failed };
    if (failed >= MAX_FAILED_ATTEMPTS) {
      patch.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60000);
      patch.failed_login_count = 0;
    }
    await update("users", user.id, patch);
    return { error: "Invalid email or password" };
  }

  if (user.tenant_id) {
    const tenant = await one("SELECT status FROM tenants WHERE id=?", [user.tenant_id]);
    if (!tenant) return { error: "Invalid email or password" };
    if (tenant.status === "CANCELLED") return { error: "This account has been closed. Contact support.", blocked: true };
  }

  if (user.failed_login_count || user.locked_until) {
    await update("users", user.id, { failed_login_count: 0, locked_until: null });
  }
  return { user };
}

/**
 * Full password-only login, no 2FA. Kept for the moment right after a brand
 * new signup (identity was just proven by setting the password) and for
 * scripts/seed data. Everyday client & admin sign-in goes through
 * startLoginWithOtp() + completeLoginWithOtp() below instead.
 */
export async function login(email, password) {
  const result = await verifyCredentials(email, password);
  if (result.error) return result.blocked ? { blocked: result.error } : null;

  const user = result.user;
  await update("users", user.id, { last_login_at: new Date() });
  const session = await buildSession(user);
  await setCookie(session);
  return session;
}

/**
 * Step 1 of the OTP / two-factor sign-in used by both the client and admin
 * login screens: verify the password, then email a 6-digit code and hand
 * back a short-lived challenge token. No session cookie is set yet - that
 * only happens once the code is verified in completeLoginWithOtp().
 */
export async function startLoginWithOtp(email, password, { ip = null, appUrl = null } = {}) {
  const result = await verifyCredentials(email, password);
  if (result.error) return result.blocked ? { blocked: result.error } : { error: result.error };

  const user = result.user;
  if (Number(user.two_factor_enabled) === 0) {
    // 2FA explicitly turned off for this account - fall back to a normal login.
    await update("users", user.id, { last_login_at: new Date() });
    const session = await buildSession(user);
    await setCookie(session);
    return { session };
  }

  const { token, expiresInMinutes } = await startOtpChallenge({
    userId: user.id,
    email: user.email,
    name: user.name,
    purpose: "LOGIN",
    ip,
    appUrl,
  });
  return {
    otpRequired: true,
    challenge: token,
    expiresInMinutes,
    maskedEmail: maskEmail(user.email),
  };
}

/** Step 2: verify the emailed code, then actually create the session. */
export async function completeLoginWithOtp(challenge, code) {
  const { userId } = await verifyOtpChallenge(challenge, code); // throws with a user-facing message on failure
  const user = await one("SELECT * FROM users WHERE id=? AND active=1", [userId]);
  if (!user) throw new Error("Account not found");

  await update("users", user.id, { last_login_at: new Date(), otp_verified_once: 1 });
  const session = await buildSession(user);
  await setCookie(session);
  return session;
}

function maskEmail(email) {
  const [user, domain] = String(email).split("@");
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"*".repeat(Math.max(1, user.length - visible.length))}@${domain}`;
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

/**
 * Forgot-password flow, OTP-based (no email links/tokens to click - consistent
 * with the login 2FA UX and avoids building a separate "reset link" mailer).
 * Always returns success-shaped data even for an unknown email, so the
 * endpoint never reveals whether an address has an account.
 */
export async function startPasswordReset(email, { ip = null, appUrl = null } = {}) {
  const user = await one("SELECT id,name,email FROM users WHERE email=? AND active=1", [email]);
  if (!user) return { otpRequired: true, challenge: null }; // caller just shows the generic "check your email" message
  const { token, expiresInMinutes } = await startOtpChallenge({
    userId: user.id,
    email: user.email,
    name: user.name,
    purpose: "RESET_PASSWORD",
    ip,
    appUrl,
  });
  return { otpRequired: true, challenge: token, expiresInMinutes };
}

export async function completePasswordReset(challenge, code, newPassword) {
  if (!challenge) throw new Error("Invalid or expired reset session");
  if (!newPassword || String(newPassword).length < 6) throw new Error("Password must be at least 6 characters");
  const { userId, purpose } = await verifyOtpChallenge(challenge, code);
  if (purpose !== "RESET_PASSWORD") throw new Error("Invalid verification session");
  await update("users", userId, {
    password_hash: await bcrypt.hash(newPassword, 10),
    failed_login_count: 0,
    locked_until: null,
  });
  return true;
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
