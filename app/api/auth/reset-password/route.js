import { NextResponse } from "next/server";
import { completePasswordReset } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/security/rateLimit.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const ip = clientIp(request);
  const rl = await rateLimit(`reset-pw:${ip}`, { max: 10, windowSec: 600 });
  if (!rl.allowed) return NextResponse.json({ error: rl.message }, { status: 429 });

  const { challenge, code, password } = await request.json();
  if (!challenge || !code || !password) {
    return NextResponse.json({ error: "Code and new password are required" }, { status: 400 });
  }

  try {
    await completePasswordReset(challenge, code, password);
    return NextResponse.json({ ok: true, message: "Password updated. You can now sign in." });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not reset password" }, { status: 400 });
  }
}
