import { NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/mail/queue.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * HTTP-triggerable version of the background email worker, for deployments
 * that use a platform cron (e.g. Vercel Cron) instead of the standalone
 * `node scripts/scheduler.js` process. Protected the same way as
 * /api/ai/nightly - a shared secret header, not a session cookie.
 *
 * Vercel example (vercel.json):
 *   { "crons": [{ "path": "/api/cron/mail-worker", "schedule": "* * * * *" }] }
 * and set CRON_SECRET (Vercel sends it as the Authorization header) or keep
 * using x-scheduler-key like the rest of this app's cron endpoints.
 */
export async function POST(request) {
  const key = request.headers.get("x-scheduler-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.SESSION_SECRET || "";
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const result = await processEmailQueue(25);
  return NextResponse.json(result);
}

export async function GET(request) {
  return POST(request);
}
