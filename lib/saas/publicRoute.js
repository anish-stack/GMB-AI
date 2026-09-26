import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/security/rateLimit.js";
import { getSettings } from "@/lib/saas/settings.js";

/** Public (no session) JSON route with IP rate limit + signup-enabled check. */
export function signupRoute(name, { max = 10, windowSec = 600 } = {}, handler) {
  return async function route(request) {
    try {
      const ip = clientIp(request);
      const rl = await rateLimit(`${name}:${ip}`, { max, windowSec });
      if (!rl.allowed) return NextResponse.json({ ok: false, error: rl.message }, { status: 429 });
      const settings = await getSettings();
      if (Number(settings.allow_signup) !== 1) {
        return NextResponse.json({ ok: false, error: "Self signup is disabled. Contact sales." }, { status: 403 });
      }
      const body = await request.json().catch(() => ({}));
      const data = await handler({ body, ip, request });
      return data instanceof Response ? data : NextResponse.json({ ok: true, ...data });
    } catch (err) {
      const status = err?.status >= 400 && err?.status < 600 ? err.status : 500;
      if (status === 500) console.error(`[${name}]`, err);
      return NextResponse.json({ ok: false, error: status === 500 ? "Something went wrong. Please try again." : err.message }, { status });
    }
  };
}
