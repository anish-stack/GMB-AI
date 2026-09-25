import { NextResponse } from "next/server";
import { resendOtpChallenge } from "@/lib/otp.js";
import { rateLimit, clientIp } from "@/lib/security/rateLimit.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const ip = clientIp(request);
  const rl = await rateLimit(`otp-resend:${ip}`, { max: 6, windowSec: 300 });
  if (!rl.allowed) return NextResponse.json({ error: rl.message }, { status: 429 });

  const { challenge } = await request.json();
  if (!challenge) return NextResponse.json({ error: "Missing verification session" }, { status: 400 });

  try {
    const result = await resendOtpChallenge(challenge);
    return NextResponse.json({ ok: true, challenge: result.token, expiresInMinutes: result.expiresInMinutes });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not resend code" }, { status: 400 });
  }
}
