import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { listTasks } from "@/lib/repo/tasks.js";
import { createTask, runTaskPipeline } from "@/lib/ai/orchestrator.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request) {
  const g = await guard(request, { permission: "task.view" });
  if (g.error) return g.error;
  const { searchParams } = new URL(request.url);
  const tasks = await listTasks({
    tenantId: g.ctx.tenantId,
    status: searchParams.get("status") || null,
    clientId: searchParams.get("clientId") ? Number(searchParams.get("clientId")) : null,
  });
  return NextResponse.json({ tasks });
}

/** Create a task on demand and run the full AI pipeline immediately. */
export async function POST(request) {
  const g = await guard(request, { permission: "task.generate" });
  if (g.error) return g.error;
  const { ctx } = g;
  try {
    const body = await request.json();
    if (!body.clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    await assertClientInTenant(Number(body.clientId), ctx.tenantId);

    const taskId = await createTask({
      clientId: Number(body.clientId),
      postType: body.postType || "Service",
      topic: body.topic || null,
      scheduledDate: body.scheduledDate || new Date().toISOString().slice(0, 10),
    });
    const result = await runTaskPipeline(taskId);
    await audit(ctx, "TASK_GENERATED", { entity: "task", entityId: taskId, meta: { credits: result.credits } });
    return NextResponse.json({ ok: result.ok, taskId, ...result });
  } catch (err) {
    return apiError(err);
  }
}
