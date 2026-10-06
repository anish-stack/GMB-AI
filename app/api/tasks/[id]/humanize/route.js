import { route } from "@/lib/saas/routeKit.js";
import { one, update } from "@/lib/db";
import { buildKnowledge } from "@/lib/repo/knowledge.js";
import { humanizePost } from "@/lib/ai/agents/humanize.js";
import { getTask } from "@/lib/repo/tasks.js";
import { assertUserRate } from "@/lib/api/rateLimiter.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST -> rewrites the current title/description to read more human; returns the new AI score. */
export const POST = route(
  { permission: "task.edit" },
  async ({ ctx, params }) => {
    const id = Number(params.id);

    console.log("[Humanize] Request started", {
      taskId: id,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    });

    try {
      console.log("[Humanize] Fetching task...", { taskId: id });

      const t = await one("SELECT * FROM ai_tasks WHERE id=? AND tenant_id=?", [
        id,
        ctx.tenantId,
      ]);

      if (!t) {
        console.error("[Humanize] Task not found", {
          taskId: id,
          tenantId: ctx.tenantId,
        });

        throw Object.assign(new Error("Task not found"), {
          status: 404,
        });
      }

      console.log("[Humanize] Task found", {
        taskId: t.id,
        clientId: t.client_id,
        status: t.status,
        currentAiScore: t.ai_score,
        originalAiScore: t.ai_score_original,
        humanized: t.humanized,
        titleLength: t.title?.length || 0,
        descriptionLength: t.description?.length || 0,
      });

      if (["PUBLISHED", "POST_DELETED"].includes(t.status)) {
        console.warn("[Humanize] Task cannot be humanized", {
          taskId: id,
          status: t.status,
        });

        throw Object.assign(
          new Error("Already published - edit the live post instead."),
          { status: 400 },
        );
      }

      console.log("[Humanize] Checking rate limit...", {
        userId: ctx.userId,
      });

      await assertUserRate(ctx.userId, "humanize", 10, 60);

      console.log("[Humanize] Rate limit passed");

      console.log("[Humanize] Building knowledge...", {
        clientId: t.client_id,
      });

      const kb = await buildKnowledge(t.client_id);

      console.log("[Humanize] Knowledge built", {
        clientId: t.client_id,
        hasKnowledge: !!kb,
        knowledgeKeys: kb && typeof kb === "object" ? Object.keys(kb) : [],
      });

      const parse = (v) => {
        try {
          return JSON.parse(v || "[]");
        } catch (err) {
          console.warn("[Humanize] Failed to parse keyword JSON", {
            value: v,
            error: err?.message,
          });

          return [];
        }
      };

      const input = {
        title: t.title,
        description: t.description,
        primary_keyword: t.primary_keyword,
        secondary_keywords: parse(t.secondary_keywords),
        tertiary_keywords: parse(t.tertiary_keywords),
      };

      const seed = `${id}-${Date.now()}`;

      console.log("[Humanize] Starting AI humanization", {
        taskId: id,
        seed,
        target: 20,
        attempts: 3,
        input: {
          title: input.title,
          descriptionLength: input.description?.length || 0,
          primary_keyword: input.primary_keyword,
          secondary_keywords: input.secondary_keywords,
          tertiary_keywords: input.tertiary_keywords,
        },
      });

      const startTime = Date.now();

      const res = await humanizePost(kb, input, {
        ctx: { taskId: id, tenantId: ctx.tenantId, seed },
        target: 20,
        attempts: 3,
        force: true,
        keepTitle: true,
      });
      console.log("[Humanize] AI humanization completed", {
        taskId: id,
        durationMs: Date.now() - startTime,
        scoreBefore: res.ai_score_original,
        scoreAfter: res.ai_score,
        humanized: res.humanized,
        titleChanged: t.title !== res.title,
        descriptionChanged: t.description !== res.description,
        resultTitleLength: res.title?.length || 0,
        resultDescriptionLength: res.description?.length || 0,
        signals: res.signals,
      });

      const updatePayload = {
        title: res.title,
        description: res.description,
        ai_score: res.ai_score,
        ai_score_original: t.ai_score_original ?? res.ai_score_original,
        humanized: res.humanized ? 1 : t.humanized,
        ai_signals: JSON.stringify(res.signals),
      };

      console.log("[Humanize] Updating task...", {
        taskId: id,
        updatePayload: {
          ai_score: updatePayload.ai_score,
          ai_score_original: updatePayload.ai_score_original,
          humanized: updatePayload.humanized,
          titleLength: updatePayload.title?.length || 0,
          descriptionLength: updatePayload.description?.length || 0,
        },
      });

      await update("ai_tasks", id, updatePayload);

      console.log("[Humanize] Task updated successfully", {
        taskId: id,
      });

      const updatedTask = await getTask(id);

      console.log("[Humanize] Request completed", {
        taskId: id,
        finalScore: res.ai_score,
        improvedFrom: res.ai_score_original,
      });

      return {
        task: updatedTask,
        improvedFrom: t.ai_score_original ?? res.ai_score_original,
        score: res.ai_score,
        changed: res.changed,
      };
    } catch (error) {
      console.error("[Humanize] Request failed", {
        taskId: id,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        message: error?.message,
        status: error?.status,
        stack: error?.stack,
      });

      throw error;
    }
  },
);
