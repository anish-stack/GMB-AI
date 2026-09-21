import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { approveTask, rejectTask, getTask } from "@/lib/repo/tasks.js";
import { assertFeature } from "@/lib/saas/entitlements.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request) {
  const g = await guard(request, { permission: "task.bulk" });
  if (g.error) return g.error;
  const { ctx } = g;

  try {
    if (ctx.ent) assertFeature(ctx.ent, "f_bulk_actions");
    const body = await request.json();
    const taskIds = Array.isArray(body.taskIds) ? body.taskIds.map(Number).filter(Boolean) : [];
    if (!taskIds.length) return NextResponse.json({ error: "taskIds is required" }, { status: 400 });
    if (!["approve", "reject"].includes(body.action)) {
      return NextResponse.json({ error: `Unsupported bulk action: ${body.action}` }, { status: 400 });
    }

    const results = [];
    for (const taskId of taskIds) {
      try {
        if (body.action === "approve") await approveTask(taskId, ctx.session, ctx.tenantId);
        else await rejectTask(taskId, ctx.session, body.reason || "Bulk rejected", ctx.tenantId);
        const task = await getTask(taskId, ctx.tenantId);
        results.push({ taskId, ok: true, status: task?.status });
      } catch (err) {
        results.push({ taskId, ok: false, error: err.message });
      }
    }
    await audit(ctx, `BULK_${body.action.toUpperCase()}`, { entity: "task", meta: { count: taskIds.length } });

    return NextResponse.json({
      ok: results.every((r) => r.ok),
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    return apiError(err);
  }
}
