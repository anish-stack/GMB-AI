import { NextResponse } from "next/server";
import { login } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  const session = await login(String(email).trim().toLowerCase(), password);
  if (!session) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  if (session.blocked) return NextResponse.json({ error: session.blocked }, { status: 403 });
  return NextResponse.json({
    ok: true,
    role: session.role,
    redirect: session.tenantId ? "/dashboard" : "/admin",
  });
}
