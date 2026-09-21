import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { getTask, editTask, approveTask, rejectTask, publishTask, assertTaskInTenant } from "@/lib/repo/tasks.js";
import { runTaskPipeline } from "@/lib/ai/orchestrator.js";
import { assertCan } from "@/lib/saas/rbac.js";
import { assertFeature } from "@/lib/saas/entitlements.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request, { params }) {
  const g = await guard(request, { permission: "task.view" });
  if (g.error) return g.error;
  const { id } = await params;
  const task = await getTask(Number(id), g.ctx.tenantId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task });
}

/** body.action: edit | approve | reject | regenerate | publish */
export async function POST(request, { params }) {
  const g = await guard(request, { permission: "task.view" });
  if (g.error) return g.error;
  const { ctx } = g;
  const session = ctx.session;
  const { id } = await params;
  const taskId = Number(id);
  const tenantId = ctx.tenantId;

  try {
    await assertTaskInTenant(taskId, tenantId);
    const body = await request.json();

    switch (body.action) {
      case "edit":
        assertCan(ctx, "task.edit");
        await editTask(taskId, session, body.fields || {}, tenantId);
        break;
      case "approve":
        assertCan(ctx, "task.approve");
        if (body.fields) await editTask(taskId, session, body.fields, tenantId);
        await approveTask(taskId, session, tenantId);
        break;
      case "reject":
        assertCan(ctx, "task.reject");
        await rejectTask(taskId, session, body.reason, tenantId);
        break;
      case "regenerate": {
        assertCan(ctx, "task.generate");
        const { query } = await import("@/lib/db");
        await query("UPDATE ai_tasks SET regenerate_count=regenerate_count+1 WHERE id=?", [taskId]);
        const result = await runTaskPipeline(taskId, { regenerate: true });
        if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.code ? 402 : 500 });
        break;
      }
      case "publish": {
        assertCan(ctx, "task.publish");
        if (ctx.ent && process.env.GMB_PROVIDER === "google") assertFeature(ctx.ent, "f_google_publish");
        const published = await publishTask(taskId, session, tenantId);
        await audit(ctx, "TASK_PUBLISHED", { entity: "task", entityId: taskId });
        return NextResponse.json({ ok: true, published, task: await getTask(taskId, tenantId) });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
    await audit(ctx, `TASK_${String(body.action).toUpperCase()}`, { entity: "task", entityId: taskId });
    return NextResponse.json({ ok: true, task: await getTask(taskId, tenantId) });
  } catch (err) {
    return apiError(err);
  }
}
