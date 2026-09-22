import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { saveUploadedImage } from "@/lib/images/imageService.js";
import { deleteImage } from "@/lib/storage/index.js";
import { getTask, editTask, updatePublishedPost, logAction } from "@/lib/repo/tasks.js";
import { addImageCandidate, getSelectedCandidate, markCandidateDeleted } from "@/lib/repo/imageCandidates.js";
import { update } from "@/lib/db.js";
import { TASK_STATUS } from "@/lib/constants.js";

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
    const stored = await saveUploadedImage(buffer, file.type, taskId);

    if (task.status === TASK_STATUS.PUBLISHED) {
      // Post is already live - push the new image straight to GMB instead of just saving it locally.
      await updatePublishedPost(taskId, ctx.session, { image_url: stored.url, image_provider: "manual_upload" }, ctx.tenantId);
    } else {
      await editTask(taskId, ctx.session, { image_url: stored.url, image_provider: "manual_upload" }, ctx.tenantId);
    }
    await update("ai_tasks", taskId, { image_storage_provider: stored.provider, image_storage_key: stored.key });

    // Old image (AI-generated or a previous upload) is being replaced - clean it out of storage too.
    if (task.image_storage_provider && task.image_storage_key) {
      await deleteImage(task.image_storage_provider, task.image_storage_key);
    }
    const prevCandidate = await getSelectedCandidate(taskId);
    if (prevCandidate) await markCandidateDeleted(prevCandidate.id);
    await addImageCandidate({
      taskId,
      tenantId: ctx.tenantId || task.tenant_id || null,
      url: stored.url,
      storageProvider: stored.provider,
      storageKey: stored.key,
      aiProvider: "manual_upload",
      status: "SELECTED",
    });

    await logAction(taskId, ctx.session, "image_upload", "Reviewer uploaded a replacement image");
    return NextResponse.json({ ok: true, url: stored.url, task: await getTask(taskId, ctx.tenantId) });
  } catch (err) {
    return apiError(err);
  }
}
