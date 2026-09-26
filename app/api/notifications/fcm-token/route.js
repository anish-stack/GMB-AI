import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { registerFcmToken, removeFcmToken } from "@/lib/notifications/service.js";

export const dynamic = "force-dynamic";

/** POST { token, platform } - register / refresh this device. */
export async function POST(request) {
  const g = await guard(request);
  if (g.error) return g.error;
  try {
    const body = await request.json().catch(() => ({}));
    await registerFcmToken({
      userId: g.ctx.userId,
      tenantId: g.ctx.tenantId,
      token: body.token,
      platform: body.platform,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

/** DELETE { token } - this device opted out. */
export async function DELETE(request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const body = await request.json().catch(() => ({}));
  await removeFcmToken(g.ctx.userId, body.token);
  return NextResponse.json({ ok: true });
}
