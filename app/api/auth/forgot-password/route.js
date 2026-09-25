import { NextResponse } from "next/server";
import { startPasswordReset } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/security/rateLimit.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const ip = clientIp(request);
  const rl = await rateLimit(`forgot-pw:${ip}`, { max: 6, windowSec: 600 });
  if (!rl.allowed) return NextResponse.json({ error: rl.message }, { status: 429 });

  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const appUrl = process.env.APP_URL || new URL(request.url).origin;
  const result = await startPasswordReset(String(email).trim().toLowerCase(), { ip, appUrl });

  // Always the same response shape, whether or not the email exists, so we
  // never leak which addresses have accounts.
  return NextResponse.json({
    ok: true,
    challenge: result.challenge,
    message: "If an account exists for that email, a verification code has been sent.",
  });
}
