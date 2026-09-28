import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { unsign, verifyCallback, resolveGoogleUser, NONCE_COOKIE } from "@/lib/googleLogin.js";
import { loginUserById } from "@/lib/auth";
import { getSettings } from "@/lib/saas/settings.js";
import { rateLimit, clientIp } from "@/lib/security/rateLimit.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const base = (process.env.APP_URL || url.origin).replace(/\/$/, "");
  const fail = (code) => {
    const res = NextResponse.redirect(`${base}/login?google_error=${encodeURIComponent(code)}`);
    res.cookies.delete({ name: NONCE_COOKIE, path: "/api/auth/google" });
    return res;
  };

  const rl = await rateLimit(`google-login:${clientIp(request)}`, { max: 20, windowSec: 600 });
  if (!rl.allowed) return fail("rate_limited");
  if (url.searchParams.get("error")) return fail("cancelled");

  const state = unsign(url.searchParams.get("state"));
  const jar = await cookies();
  const nonce = jar.get(NONCE_COOKIE)?.value;
  if (!state || !nonce || state.n !== nonce) return fail("state");

  try {
    const profile = await verifyCallback(url.searchParams.get("code"));
    const r = await resolveGoogleUser(profile);
    if (r.userId) {
      const session = await loginUserById(r.userId);
      await audit({ tenantId: session?.tenantId || null, session }, "LOGIN_GOOGLE", { meta: { email: profile.email } }).catch(() => {});
      const res = NextResponse.redirect(`${base}${state.next || r.redirect}`);
      res.cookies.delete({ name: NONCE_COOKIE, path: "/api/auth/google" });
      return res;
    }
    const settings = await getSettings();
    if (Number(settings.allow_signup) !== 1) return fail("no_account");
    const res = NextResponse.redirect(`${base}/signup?g=${encodeURIComponent(r.signupToken)}`);
    res.cookies.delete({ name: NONCE_COOKIE, path: "/api/auth/google" });
    return res;
  } catch (err) {
    console.error("[google-login]", err.message);
    return fail(/closed|disabled/i.test(err.message) ? "blocked" : "failed");
  }
}
