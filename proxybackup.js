import { NextResponse } from "next/server";

/**
 * Global security headers. Kept here (Proxy (formerly middleware)) rather than in
 * next.config.mjs `headers()` so it also applies to dynamic API routes.
 * Per-route rate limiting and auth checks (lib/security/rateLimit.js,
 * lib/saas/guard.js) still happen inside the Node runtime route handlers -
 * middleware can't touch the database (Edge runtime), so it only handles
 * cheap, stateless protections here.
 */
export function proxy(request) {
  const res = NextResponse.next();

  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // HSTS only makes sense once you're actually serving over HTTPS in production.
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }

  return res;
}

export const config = {
  // Skip static assets/_next internals; apply to pages + API routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
