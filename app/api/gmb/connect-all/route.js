import { NextResponse } from "next/server";
import { getContext } from "@/lib/saas/context.js";
import { buildAuthUrl, isOAuthConfigured } from "@/lib/gmb/googleAuth.js";
import { createState } from "@/lib/gmb/bulkConnect.js";

export const dynamic = "force-dynamic";

/** Staff: connect a Google login to import MANY listings as separate clients. */
export async function GET(request) {
  const base = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const ctx = await getContext();
  if (!ctx?.tenantId) return NextResponse.redirect(`${base}/login`);
  if (!ctx.can?.("gmb.connect")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!isOAuthConfigured()) return NextResponse.json({ error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set" }, { status: 500 });
  return NextResponse.redirect(buildAuthUrl(createState({ k: "bulk", t: ctx.tenantId, u: ctx.name })));
}
