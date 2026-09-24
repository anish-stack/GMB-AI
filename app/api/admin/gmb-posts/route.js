import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { approveTask, rejectTask, publishTask, deletePublishedPost, getTask } from "@/lib/repo/tasks.js";
import { runTaskPipeline } from "@/lib/ai/orchestrator.js";
import { hardDeleteTask, setTaskStatus } from "@/lib/repo/adminGmb.js";
import { audit } from "@/lib/saas/audit.js";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ACTIONS = ["approve", "reject", "publish", "delete_post", "delete", "set_status", "regenerate"];

/**
 * Super admin bulk/single actions on any tenant's GMB posts.
 * body: { action, ids: number[], status?, reason?, force? }
 */
export async function POST(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { ctx } = g;
  const session = ctx.session;

  try {
    const body = await request.json();
    const ids = [...new Set((Array.isArray(body.ids) ? body.ids : [body.id]).map(Number).filter(Boolean))];
    if (!ids.length) return NextResponse.json({ error: "ids is required" }, { status: 400 });
    if (!ACTIONS.includes(body.action)) return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });

    const results = [];
    for (const id of ids) {
      try {
        let out = null;
        switch (body.action) {
          case "approve":
            await approveTask(id, session);
            break;
          case "reject":
            await rejectTask(id, session, body.reason || "Rejected by super admin");
            break;
          case "publish":
            out = await publishTask(id, session);
            break;
          case "delete_post":
            out = await deletePublishedPost(id, session);
            break;
          case "delete":
            out = await hardDeleteTask(id, session, { force: Boolean(body.force) });
            break;
          case "set_status":
            out = await setTaskStatus(id, String(body.status || ""), session, body.reason || null);
            break;
          case "regenerate": {
            await query("UPDATE ai_tasks SET regenerate_count=regenerate_count+1 WHERE id=?", [id]);
            const r = await runTaskPipeline(id, { regenerate: true });
            if (!r.ok) throw new Error(r.error || "Regeneration failed");
            break;
          }
        }
        const task = body.action === "delete" ? null : await getTask(id);
        results.push({ id, ok: true, status: task?.status ?? null, out });
      } catch (err) {
        results.push({ id, ok: false, error: err.message, code: err.code || null });
      }
    }

    await audit(ctx, `ADMIN_POST_${String(body.action).toUpperCase()}`, {
      entity: "task",
      entityId: ids.length === 1 ? ids[0] : null,
      meta: { ids, status: body.status || null, force: Boolean(body.force), failed: results.filter((r) => !r.ok).length },
    });

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
