import { NextResponse } from "next/server";
import { login } from "@/lib/auth";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const session = await login(String(email || "").trim(), String(password || ""));
    if (!session) return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401 });
    return NextResponse.json({ ok: true, user: { name: session.name, role: session.role } });
  } catch (err) {
    return NextResponse.json({ error: `Sign in failed: ${err.message}` }, { status: 500 });
  }
}
