import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { getSettings, setSettings } from "@/lib/saas/settings.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const s = await getSettings({ fresh: true });
  return NextResponse.json({ settings: { ...s, razorpay_key_secret: s.razorpay_key_secret ? "********" : "" } });
}

export async function PATCH(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  try {
    const body = await request.json();
    if (body.razorpay_key_secret === "********") delete body.razorpay_key_secret;
    const settings = await setSettings(body);
    await audit(g.ctx, "ADMIN_SETTINGS_UPDATED", { meta: Object.keys(body) });
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return apiError(err);
  }
}
