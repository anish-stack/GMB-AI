import "server-only";
import { query, one, insert, update } from "../db.js";
import { TASK_STATUS, QA_PASS_SCORE } from "../constants.js";
import { buildKnowledge } from "../repo/knowledge.js";
import { runResearchAgent } from "./agents/research.js";
import { runKeywordAgent, saveKeywords } from "./agents/keyword.js";
import { runTopicAgent } from "./agents/topic.js";
import { runContentAgent } from "./agents/content.js";
import { runHashtagAgent } from "./agents/hashtag.js";
import { runQAAgent } from "./agents/qa.js";
import { checkDuplicate } from "./embeddings.js";
import { generateImage } from "../images/imageService.js";

async function setStatus(taskId, status, extra = {}) {
  await update("ai_tasks", taskId, { status, ...extra });
}

/**
 * Full AI pipeline for one task.
 *
 * Timing: agents that do not depend on each other run in parallel.
 *   stage 1  research + keywords      (parallel)
 *   stage 2  topic
 *   stage 3  content  -> duplicate check -> one regeneration if too similar
 *   stage 4  hashtags + image + QA    (parallel)
 * That removes roughly 35-40 seconds compared with running all seven in sequence.
 *
 * Statuses: PENDING -> RESEARCHING -> KEYWORD_RESEARCH -> GENERATING
 *           -> IMAGE_GENERATING -> QA_RUNNING -> READY_FOR_REVIEW | NEEDS_REVIEW
 * On failure the task is kept and marked FAILED with the error message.
 */
export async function runTaskPipeline(taskId, { regenerate = false } = {}) {
  const task = await one("SELECT * FROM ai_tasks WHERE id=?", [taskId]);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const ctx = { taskId, seed: `${taskId}-${task.regenerate_count || 0}-${Date.now() % 100000}` };
  const startedAt = Date.now();

  try {
    const kb = await buildKnowledge(task.client_id);

    // ---- stage 1: research + keywords in parallel ----------------------
    await setStatus(taskId, TASK_STATUS.RESEARCHING, { error_message: null });
    const [research, keywords] = await Promise.all([
      runResearchAgent(kb, ctx),
      runKeywordAgent(kb, null, ctx),
    ]);
    await setStatus(taskId, TASK_STATUS.KEYWORD_RESEARCH, { research, keyword_data: keywords });
    saveKeywords(task.client_id, keywords).catch((e) => console.error("keyword save:", e.message));

    // ---- stage 2: topic ------------------------------------------------
    const topic = await runTopicAgent(
      kb,
      {
        keywords,
        postType: task.post_type || "Service",
        presetTopic: regenerate ? null : task.topic || null,
      },
      ctx
    );
    await update("ai_tasks", taskId, {
      topic: topic.topic,
      topic_reason: topic.reason,
      topic_priority: topic.priority,
    });

    // ---- stage 3: content + duplicate check ----------------------------
    await setStatus(taskId, TASK_STATUS.GENERATING);
    const previousTitles = (
      await query("SELECT title FROM gmb_posts WHERE client_id=? ORDER BY id DESC LIMIT 8", [task.client_id])
    ).map((r) => r.title);

    const secondary = [
      ...(keywords.secondary_keywords || []),
      ...(keywords.long_tail_keywords || []),
    ].map((k) => k.keyword);

    const contentInput = {
      topic: topic.topic,
      primaryKeyword: topic.target_keyword,
      secondaryKeywords: secondary.slice(0, 3),
      postType: task.post_type || "Service",
      service: kb.services.find((s) => topic.topic.toLowerCase().includes(s.toLowerCase())),
      cta: null,
      avoidTitles: previousTitles,
    };

    let content = await runContentAgent(kb, contentInput, ctx);
    let dup = await checkDuplicate({
      clientId: task.client_id,
      taskId,
      title: content.title,
      description: content.description,
    });

    if (dup.duplicate) {
      content = await runContentAgent(
        kb,
        { ...contentInput, topic: `${topic.topic} (different angle)`, avoidTitles: [...previousTitles, content.title] },
        { ...ctx, seed: `${ctx.seed}-retry` }
      );
      dup = await checkDuplicate({
        clientId: task.client_id,
        taskId,
        title: content.title,
        description: content.description,
      });
    }

    await update("ai_tasks", taskId, {
      title: content.title,
      description: content.description,
      cta: content.cta,
      primary_keyword: content.primary_keyword,
      secondary_keywords: content.secondary_keywords,
      image_concept: content.image_concept,
      embedding: dup.vector,
      duplicate_score: dup.score,
      duplicate_of: dup.matchTaskId,
    });

    // ---- stage 4: hashtags + image + QA in parallel ---------------------
    await setStatus(taskId, TASK_STATUS.IMAGE_GENERATING);
    const [hashtags, image, qa] = await Promise.all([
      runHashtagAgent(kb, { title: content.title, topic: topic.topic, primaryKeyword: content.primary_keyword }, ctx),
      generateImage(kb, { topic: topic.topic, service: kb.services[0], concept: content.image_concept }, ctx),
      runQAAgent(
        kb,
        {
          title: content.title,
          description: content.description,
          primary_keyword: content.primary_keyword,
          cta: content.cta,
        },
        { ...ctx, duplicate: dup.duplicate, duplicateScore: dup.score }
      ),
    ]);

    await insert("ai_reviews", {
      task_id: taskId,
      score: qa.score,
      status: qa.status,
      checks: qa.checks,
      issues: qa.issues,
      warnings: qa.warnings,
    });

    const finalStatus =
      qa.score >= QA_PASS_SCORE && qa.status === "PASS"
        ? TASK_STATUS.READY_FOR_REVIEW
        : TASK_STATUS.NEEDS_REVIEW;

    // image is stored separately: a bad image must never lose the generated post
    try {
      await update("ai_tasks", taskId, { image_url: image.url, image_provider: image.provider });
    } catch (imageErr) {
      console.error("image save failed:", imageErr.message);
      await update("ai_tasks", taskId, { image_url: null, image_provider: "failed" });
    }

    await update("ai_tasks", taskId, {
      hashtags,
      qa_score: qa.score,
      qa_status: qa.status,
      status: finalStatus,
      error_message: null,
    });

    if (task.calendar_id) {
      await update("content_calendar", task.calendar_id, { status: "GENERATED", topic: topic.topic });
    }

    return { ok: true, taskId, status: finalStatus, score: qa.score, durationMs: Date.now() - startedAt };
  } catch (err) {
    await update("ai_tasks", taskId, {
      status: TASK_STATUS.FAILED,
      error_message: String(err.message).slice(0, 900),
    });
    return { ok: false, taskId, status: TASK_STATUS.FAILED, error: String(err.message), durationMs: Date.now() - startedAt };
  }
}

/** Create a PENDING task from a calendar entry (or ad-hoc for a client). */
export async function createTask({ clientId, calendarId = null, postType = "Service", topic = null, scheduledDate = null }) {
  const client = await one("SELECT assigned_employee_id FROM clients WHERE id=?", [clientId]);
  return insert("ai_tasks", {
    client_id: clientId,
    calendar_id: calendarId,
    assigned_employee_id: client ? client.assigned_employee_id : null,
    status: TASK_STATUS.PENDING,
    post_type: postType,
    topic,
    scheduled_date: scheduledDate,
  });
}

/**
 * Nightly job. Picks up every SCHEDULED calendar row for the target date.
 * Clients are processed in small parallel batches (AI_JOB_CONCURRENCY, default 3)
 * so 100 clients do not run strictly one after another.
 */
export async function runNightlyJob({ date = null, clientId = null, limit = 100 } = {}) {
  const targetDate = date || nextDay();
  const params = [targetDate];
  let sql = `SELECT c.* FROM content_calendar c
             JOIN clients cl ON cl.id=c.client_id AND cl.active=1
             WHERE c.scheduled_date=? AND c.status='SCHEDULED'`;
  if (clientId) {
    sql += " AND c.client_id=?";
    params.push(clientId);
  }
  sql += ` ORDER BY c.id LIMIT ${Number(limit)}`;

  const rows = await query(sql, params);
  const concurrency = Math.max(1, Number(process.env.AI_JOB_CONCURRENCY || 3));
  const results = [];
  const startedAt = Date.now();

  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (row) => {
        const taskId = await createTask({
          clientId: row.client_id,
          calendarId: row.id,
          postType: row.post_type,
          topic: row.topic,
          scheduledDate: row.scheduled_date,
        });
        return runTaskPipeline(taskId);
      })
    );
    results.push(...batchResults);
  }

  const durations = results.map((r) => r.durationMs || 0);
  return {
    date: targetDate,
    scheduled: rows.length,
    generated: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    ready: results.filter((r) => r.status === TASK_STATUS.READY_FOR_REVIEW).length,
    needsReview: results.filter((r) => r.status === TASK_STATUS.NEEDS_REVIEW).length,
    totalMs: Date.now() - startedAt,
    avgTaskMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    results,
  };
}

function nextDay() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
