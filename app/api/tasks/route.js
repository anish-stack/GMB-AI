import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listTasks } from "@/lib/repo/tasks.js";
import { createTask, runTaskPipeline } from "@/lib/ai/orchestrator.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request) {
  if (!(await getSession())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const tasks = await listTasks({
    status: searchParams.get("status") || null,
    clientId: searchParams.get("clientId") ? Number(searchParams.get("clientId")) : null,
  });
  return NextResponse.json({ tasks });
}

/** Create a task on demand and run the full AI pipeline immediately. */
export async function POST(request) {
  if (!(await getSession())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    const taskId = await createTask({
      clientId: Number(body.clientId),
      postType: body.postType || "Service",
      topic: body.topic || null,
      scheduledDate: body.scheduledDate || new Date().toISOString().slice(0, 10),
    });
    const result = await runTaskPipeline(taskId);
    return NextResponse.json({ ok: result.ok, taskId, ...result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
