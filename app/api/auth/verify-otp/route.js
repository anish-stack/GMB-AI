import { NextResponse } from "next/server";
import { completeLoginWithOtp } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/security/rateLimit.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const ip = clientIp(request);
  const rl = await rateLimit(`otp-verify:${ip}`, { max: 20, windowSec: 300 });
  if (!rl.allowed) return NextResponse.json({ error: rl.message }, { status: 429 });

  const { challenge, code } = await request.json();
  if (!challenge || !code) {
    return NextResponse.json({ error: "A verification code is required" }, { status: 400 });
  }

  try {
    const session = await completeLoginWithOtp(challenge, code);
    return NextResponse.json({
      ok: true,
      role: session.role,
      redirect: session.tenantId ? "/dashboard" : "/admin",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Verification failed" }, { status: 401 });
  }
}
