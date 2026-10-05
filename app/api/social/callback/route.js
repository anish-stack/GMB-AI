import { NextResponse } from "next/server";
import { handleCallback } from "@/lib/social/meta.js";
import { readState } from "@/lib/gmb/bulkConnect.js";

export const dynamic = "force-dynamic";

/** Facebook sends the user back here -> pick the page in the GMB panel. */
export async function GET(request) {
  const url = new URL(request.url);
  const base = (process.env.APP_URL || url.origin).replace(/\/$/, "");
  const st = readState(url.searchParams.get("state"));
  const clientId = Number(st?.c || 0);
  const back = (q) => NextResponse.redirect(`${base}/gmb/${clientId || ""}?tab=social&${q}`);
  if (!clientId) return NextResponse.redirect(`${base}/gmb`);
  if (url.searchParams.get("error")) return back(`social_error=${encodeURIComponent(url.searchParams.get("error_description") || "Facebook sign-in was cancelled")}`);
  try {
    const r = await handleCallback(url.searchParams.get("code"), url.searchParams.get("state"));
    return back(`pick=${r.pick}`);
  } catch (err) {
    return back(`social_error=${encodeURIComponent(err.message)}`);
  }
}
