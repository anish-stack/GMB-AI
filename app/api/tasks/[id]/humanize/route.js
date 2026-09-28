import { route } from "@/lib/saas/routeKit.js";
import { one, update } from "@/lib/db";
import { buildKnowledge } from "@/lib/repo/knowledge.js";
import { humanizePost } from "@/lib/ai/agents/humanize.js";
import { getTask } from "@/lib/repo/tasks.js";
import { assertUserRate } from "@/lib/api/rateLimiter.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST -> rewrites the current title/description to read more human; returns the new AI score. */
export const POST = route({ permission: "task.edit" }, async ({ ctx, params }) => {
  const id = Number(params.id);
  const t = await one("SELECT * FROM ai_tasks WHERE id=? AND tenant_id=?", [id, ctx.tenantId]);
  if (!t) throw Object.assign(new Error("Task not found"), { status: 404 });
  if (["PUBLISHED", "POST_DELETED"].includes(t.status)) throw Object.assign(new Error("Already published - edit the live post instead."), { status: 400 });
  await assertUserRate(ctx.userId, "humanize", 10, 60);
  const kb = await buildKnowledge(t.client_id);
  const parse = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
  const res = await humanizePost(kb, { title: t.title, description: t.description, primary_keyword: t.primary_keyword, secondary_keywords: parse(t.secondary_keywords), tertiary_keywords: parse(t.tertiary_keywords) }, { ctx: { taskId: id, tenantId: ctx.tenantId, seed: `${id}-${Date.now()}` }, target: 20, attempts: 3 });
  await update("ai_tasks", id, { title: res.title, description: res.description, ai_score: res.ai_score, ai_score_original: t.ai_score_original ?? res.ai_score_original, humanized: res.humanized ? 1 : t.humanized, ai_signals: JSON.stringify(res.signals) });
  return { task: await getTask(id), improvedFrom: res.ai_score_original, score: res.ai_score };
});
