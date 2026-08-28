import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { one } from "./db.js";

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

export async function login(email, password) {
  const user = await one("SELECT * FROM users WHERE email=? AND active=1", [email]);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;

  const employee = await one("SELECT id FROM employees WHERE user_id=?", [user.id]);
  const session = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeId: employee ? employee.id : null,
    exp: Date.now() + MAX_AGE * 1000,
  };
  const store = await cookies();
  store.set(COOKIE, sign(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
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

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}
