import { NextResponse } from "next/server";
import { startLoginWithOtp } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/security/rateLimit.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const ip = clientIp(request);
  // Brute-force guard: 10 attempts per IP per 5 minutes on top of the
  // per-account lockout in lib/auth.js (which stops targeted attacks even
  // from a rotating IP).
  const rl = await rateLimit(`login:${ip}`, { max: 10, windowSec: 300 });
  if (!rl.allowed) return NextResponse.json({ error: rl.message }, { status: 429 });

  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const appUrl = process.env.APP_URL || new URL(request.url).origin;
  const result = await startLoginWithOtp(String(email).trim().toLowerCase(), password, { ip, appUrl });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 401 });
  if (result.blocked) return NextResponse.json({ error: result.blocked }, { status: 403 });

  if (result.otpRequired) {
    return NextResponse.json({
      ok: true,
      otpRequired: true,
      challenge: result.challenge,
      expiresInMinutes: result.expiresInMinutes,
      maskedEmail: result.maskedEmail,
    });
  }

  // 2FA disabled for this account - session already created.
  return NextResponse.json({
    ok: true,
    role: result.session.role,
    redirect: result.session.tenantId ? "/dashboard" : "/admin",
  });
}
