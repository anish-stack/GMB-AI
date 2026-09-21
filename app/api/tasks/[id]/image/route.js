import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { saveUploadedImage } from "@/lib/images/imageService.js";
import { getTask, editTask, logAction } from "@/lib/repo/tasks.js";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request) {
  const g = await guard(request, { permission: "task.edit" });
  if (g.error) return g.error;
  const { ctx } = g;

  const form = await request.formData();
  const file = form.get("file");
  const taskId = Number(form.get("taskId"));
  if (!file || typeof file === "string") return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (!taskId) return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is too large. Max 8 MB." }, { status: 400 });

  const task = await getTask(taskId, ctx.tenantId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await saveUploadedImage(buffer, file.type, taskId);
    await editTask(taskId, ctx.session, { image_url: url, image_provider: "manual_upload" }, ctx.tenantId);
    await logAction(taskId, ctx.session, "image_upload", "Reviewer uploaded a replacement image");
    return NextResponse.json({ ok: true, url, task: await getTask(taskId, ctx.tenantId) });
  } catch (err) {
    return apiError(err);
  }
}
