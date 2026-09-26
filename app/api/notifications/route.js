import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { listForUser, markRead } from "@/lib/notifications/service.js";

export const dynamic = "force-dynamic";

/** GET ?limit=20&before=<id>&unread=1 -> the signed-in user's notifications. */
export async function GET(request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const sp = new URL(request.url).searchParams;
  const data = await listForUser({ id: g.ctx.userId }, { limit: sp.get("limit"), before: sp.get("before"), unreadOnly: sp.get("unread") === "1" });
  return NextResponse.json({ ok: true, ...data });
}

/** POST { ids?: number[] } -> mark read (all when ids missing). */
export async function POST(request) {
  const g = await guard(request);
  if (g.error) return g.error;
  try {
    const body = await request.json().catch(() => ({}));
    await markRead({ id: g.ctx.userId }, Array.isArray(body.ids) ? body.ids : null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
