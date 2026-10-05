import { NextResponse } from "next/server";
import { getContext } from "@/lib/saas/context.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { authUrl } from "@/lib/social/meta.js";

export const dynamic = "force-dynamic";

/** Staff: start "Connect Facebook page / Instagram" for a client. */
export async function GET(request, { params }) {
  const base = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const ctx = await getContext();
  if (!ctx?.tenantId) return NextResponse.redirect(`${base}/login`);
  const { clientId } = await params;
  try {
    if (!ctx.can?.("gmb.connect")) throw Object.assign(new Error("Not allowed"), { status: 403 });
    await assertClientInTenant(Number(clientId), ctx.tenantId);
    return NextResponse.redirect(await authUrl(Number(clientId), ctx.tenantId, ctx.name));
  } catch (err) {
    return NextResponse.redirect(`${base}/gmb/${Number(clientId)}?tab=social&social_error=${encodeURIComponent(err.message)}`);
  }
}
