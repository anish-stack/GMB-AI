import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runNightlyJob } from "@/lib/ai/orchestrator.js";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Runs the nightly pipeline for every SCHEDULED calendar entry on a date.
 * Called by the admin button (session cookie) or by scripts/scheduler.js
 * (x-scheduler-key header matching SESSION_SECRET).
 */
export async function POST(request) {
  const session = await getSession();
  const key = request.headers.get("x-scheduler-key");
  const fromScheduler = key && process.env.SESSION_SECRET && key === process.env.SESSION_SECRET;
  if (!session && !fromScheduler) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const result = await runNightlyJob({
      date: body.date || null,
      clientId: body.clientId ? Number(body.clientId) : null,
      limit: Number(body.limit || 100),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
