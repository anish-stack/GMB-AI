import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTask, editTask, approveTask, rejectTask, publishTask } from "@/lib/repo/tasks.js";
import { runTaskPipeline } from "@/lib/ai/orchestrator.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(_request, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const task = await getTask(Number(id));
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task });
}

/**
 * Single action endpoint for the review queue.
 * body.action: edit | approve | reject | regenerate | publish
 */
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const taskId = Number(id);

  try {
    const body = await request.json();
    switch (body.action) {
      case "edit":
        await editTask(taskId, session, body.fields || {});
        break;
      case "approve":
        if (body.fields) await editTask(taskId, session, body.fields);
        await approveTask(taskId, session);
        break;
      case "reject":
        await rejectTask(taskId, session, body.reason);
        break;
      case "regenerate": {
        const { query } = await import("@/lib/db");
        await query("UPDATE ai_tasks SET regenerate_count=regenerate_count+1 WHERE id=?", [taskId]);
        const result = await runTaskPipeline(taskId, { regenerate: true });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
        break;
      }
      case "publish": {
        const published = await publishTask(taskId, session);
        return NextResponse.json({ ok: true, published, task: await getTask(taskId) });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, task: await getTask(taskId) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
