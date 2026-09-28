import { NextResponse } from "next/server";
import { authUrl, googleConfigured, NONCE_COOKIE } from "@/lib/googleLogin.js";

export const dynamic = "force-dynamic";

/** GET /api/auth/google/start?next=/path -> redirects to Google's account chooser. */
export async function GET(request) {
  const base = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  if (!googleConfigured()) return NextResponse.redirect(`${base}/login?google_error=not_configured`);
  const { url, nonce } = authUrl({ next: new URL(request.url).searchParams.get("next") });
  const res = NextResponse.redirect(url);
  res.cookies.set(NONCE_COOKIE, nonce, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
  return res;
}
