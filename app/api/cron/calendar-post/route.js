import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/security/crypto.js";
import { maintenanceState } from "@/lib/system/maintenance.js";
import { getContext } from "@/lib/saas/context.js";
import { runCalendarPublisher } from "@/lib/posting/calendarPublisher.js";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Calendar auto-post run (writes + publishes calendar posts at their time).
 * Called every 2 minutes by scripts/scheduler.js (x-scheduler-key = SESSION_SECRET),
 * or by a super admin. Runs inside Next so image rendering (next/og) works.
 */
export async function POST(request) {
  const key = request.headers.get("x-scheduler-key");
  const fromScheduler = Boolean(key && process.env.SESSION_SECRET && safeEqual(key, process.env.SESSION_SECRET));
  if (!fromScheduler) {
    const ctx = await getContext();
    if (!ctx?.isSuperAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if ((await maintenanceState()).enabled) return NextResponse.json({ ok: true, skipped: "maintenance" });
  try {
    return NextResponse.json({ ok: true, ...(await runCalendarPublisher()) });
  } catch (err) {
    console.error("[calendar-post]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
