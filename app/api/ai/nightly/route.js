import { NextResponse } from "next/server";
import { getContext } from "@/lib/saas/context.js";
import { apiError } from "@/lib/saas/guard.js";
import { runNightlyJob } from "@/lib/ai/orchestrator.js";
import { can } from "@/lib/saas/rbac.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Runs the pipeline for every SCHEDULED calendar entry on a date.
 * Called by the in-app button (session cookie) or scripts/scheduler.js
 * (x-scheduler-key header matching SESSION_SECRET - runs for every tenant).
 */
export async function POST(request) {
  const ctx = await getContext();
  const key = request.headers.get("x-scheduler-key");
  const fromScheduler = key && process.env.SESSION_SECRET && key === process.env.SESSION_SECRET;

  if (!ctx && !fromScheduler) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (ctx && !fromScheduler && !can(ctx.role, "task.generate")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

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
      tenantId: fromScheduler ? (body.tenantId ? Number(body.tenantId) : null) : ctx?.tenantId || null,
      limit: Number(body.limit || 100),
    });
    if (ctx) await audit(ctx, "AI_JOB_RUN", { meta: { generated: result.generated, credits: result.credits } });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
