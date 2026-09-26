import { NextResponse } from "next/server";
import { beat } from "@/lib/system/heartbeat.js";
import { safeEqual } from "@/lib/security/crypto.js";

export const dynamic = "force-dynamic";

/** Lets an external cron (or the scheduler) report liveness: POST with x-scheduler-key. */
export async function POST(request) {
  if (!process.env.SESSION_SECRET || !safeEqual(request.headers.get("x-scheduler-key"), process.env.SESSION_SECRET)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const b = await request.json().catch(() => ({}));
  await beat(String(b.name || "scheduler").slice(0, 60), { ok: b.ok !== false, message: b.message || null });
  return NextResponse.json({ ok: true });
}
