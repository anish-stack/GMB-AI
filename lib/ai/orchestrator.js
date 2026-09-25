import "server-only";
import { query, one, insert, update } from "../db.js";
import { TASK_STATUS, QA_PASS_SCORE, IMAGE_REGEN_LIMIT } from "../constants.js";
import { buildKnowledge } from "../repo/knowledge.js";
import { runResearchAgent } from "./agents/research.js";
import { runKeywordAgent, saveKeywords } from "./agents/keyword.js";
import { runTopicAgent } from "./agents/topic.js";
import { runContentAgent } from "./agents/content.js";
import { runHashtagAgent } from "./agents/hashtag.js";
import { runQAAgent } from "./agents/qa.js";
import { checkDuplicate } from "./embeddings.js";
import { generateImage, generateImageOptions } from "../images/imageService.js";
import { deleteImage } from "../storage/index.js";
import {
  addImageCandidate,
  listPendingCandidates,
  getImageCandidate,
  getSelectedCandidate,
  markCandidateSelected,
  markCandidateDeleted,
  getRecentImageHashes,
} from "../repo/imageCandidates.js";
import { resolveEntitlements, assertActive, assertLimit } from "../saas/entitlements.js";
import { assertCredits, estimatePostCost, creditCostFor } from "../saas/credits.js";
import { incrementUsage } from "../saas/usage.js";
import { METRICS, QuotaError } from "../saas/constants.js";
import { queueEmail } from "../mail/queue.js";
import { nightlySummaryEmail } from "../mail/templates.js";

const IMAGE_OPTIONS_DEFAULT = Number(process.env.IMAGE_OPTIONS_COUNT || 3);
const IMAGE_OPTIONS_MAX = Number(process.env.IMAGE_OPTIONS_COUNT_MAX || 6);

/** Records a freshly generated image as the task's SELECTED candidate and mirrors it onto ai_tasks. */
async function saveTaskImage(taskId, tenantId, image) {
  const candidateId = await addImageCandidate({
    taskId,
    tenantId,
    url: image.url,
    storageProvider: image.storageProvider || null,
    storageKey: image.storageKey || null,
    aiProvider: image.provider,
    prompt: image.prompt,
    status: "SELECTED",
    contentHash: image.contentHash || null,
  });
  await update("ai_tasks", taskId, {
    image_url: image.url,
    image_provider: image.provider,
    image_storage_provider: image.storageProvider || null,
    image_storage_key: image.storageKey || null,
  });
  return candidateId;
}

/** Deletes the task's previously-selected image from storage and marks its candidate row DELETED (best-effort, never throws). */
async function retireCurrentImage(task) {
  if (task.image_storage_provider && task.image_storage_key) {
    await deleteImage(task.image_storage_provider, task.image_storage_key);
  }
  const prev = await getSelectedCandidate(task.id);
  if (prev) await markCandidateDeleted(prev.id);
}

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

  const ent = task.tenant_id ? await resolveEntitlements(task.tenant_id) : null;
  if (ent) {
    try {
      assertActive(ent);
      await assertCredits(task.tenant_id, await estimatePostCost({ withImage: ent.features.f_image_generation }));
    } catch (err) {
      await update("ai_tasks", taskId, {
        status: TASK_STATUS.FAILED,
        error_message: String(err.message).slice(0, 900),
      });
      return { ok: false, taskId, status: TASK_STATUS.FAILED, error: err.message, code: err.code, durationMs: 0 };
    }
  }

  const ctx = {
    taskId,
    tenantId: task.tenant_id || null,
    imagesEnabled: ent ? Boolean(ent.features.f_image_generation) : true,
    seed: `${taskId}-${task.regenerate_count || 0}-${Date.now() % 100000}`,
  };
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
    saveKeywords(task.client_id, keywords, task.tenant_id).catch((e) => console.error("keyword save:", e.message));

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
    const recentImageHashes = new Set(await getRecentImageHashes(task.client_id, { excludeTaskId: taskId }));
    let [hashtags, image, qa] = await Promise.all([
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

    // The AI (or the deterministic placeholder) can hand back the exact same
    // picture it generated for an earlier task - happens most often when the
    // topic repeats. One retry with a nudged concept before we give up and
    // just flag it for review.
    let imageDuplicate = Boolean(image.contentHash && recentImageHashes.has(image.contentHash));
    if (imageDuplicate) {
      const retryImage = await generateImage(
        kb,
        { topic: topic.topic, service: kb.services[0], concept: `${content.image_concept || topic.topic} - different visual, new angle` },
        { ...ctx, seed: `${ctx.seed}-img-retry` }
      );
      if (!retryImage.contentHash || !recentImageHashes.has(retryImage.contentHash)) {
        image = retryImage;
        imageDuplicate = Boolean(retryImage.contentHash && recentImageHashes.has(retryImage.contentHash));
      }
    }

    if (imageDuplicate) {
      qa.warnings = [...(qa.warnings || []), "Generated image matches one already used for this client - review before publishing."];
    }

    await insert("ai_reviews", {
      task_id: taskId,
      score: qa.score,
      status: qa.status,
      checks: qa.checks,
      issues: qa.issues,
      warnings: qa.warnings,
    });

    // BUG FIX: content passing the second duplicate check was still let straight
    // through to READY_FOR_REVIEW (auto-publishable) even when the retry didn't
    // actually fix it, and a duplicate IMAGE was never checked at all - that's
    // how the same topic/image ended up going out two days running. Either kind
    // of duplicate now forces a human to look at it before it can publish.
    const finalStatus =
      qa.score >= QA_PASS_SCORE && qa.status === "PASS" && !dup.duplicate && !imageDuplicate
        ? TASK_STATUS.READY_FOR_REVIEW
        : TASK_STATUS.NEEDS_REVIEW;

    // image is stored separately: a bad image must never lose the generated post
    try {
      await saveTaskImage(taskId, task.tenant_id || null, image);
    } catch (imageErr) {
      console.error("image save failed:", imageErr.message);
      await update("ai_tasks", taskId, { image_url: null, image_provider: "failed", image_storage_provider: null, image_storage_key: null });
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

    const spent = await one(
      "SELECT COALESCE(SUM(credits_charged),0) AS c FROM ai_executions WHERE task_id=?",
      [taskId]
    );
    await update("ai_tasks", taskId, { credits_used: Number(spent?.c || 0) });
    if (task.tenant_id) await incrementUsage(task.tenant_id, METRICS.POSTS_GENERATED, 1);

    return {
      ok: true, taskId, status: finalStatus, score: qa.score,
      credits: Number(spent?.c || 0), durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    await update("ai_tasks", taskId, {
      status: TASK_STATUS.FAILED,
      error_message: String(err.message).slice(0, 900),
    });
    return { ok: false, taskId, status: TASK_STATUS.FAILED, error: String(err.message), durationMs: Date.now() - startedAt };
  }
}

/**
 * Regenerates ONLY the image for an existing task - text, hashtags, QA etc. are
 * left untouched. Capped at IMAGE_REGEN_LIMIT (default 2) regenerations per post
 * to stop runaway image-provider spend; uploading a manual image is unlimited
 * and does not touch this counter (see app/api/tasks/[id]/image/route.js).
 */
export async function regenerateTaskImage(taskId, tenantId = null) {
  const task = await one(
    `SELECT * FROM ai_tasks WHERE id=?${tenantId ? " AND tenant_id=?" : ""}`,
    tenantId ? [taskId, tenantId] : [taskId]
  );
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (task.status === TASK_STATUS.PUBLISHED) {
    throw new Error('This post is already live on GMB - upload a replacement image instead so the change reaches Google.');
  }

  const used = Number(task.image_regen_count || 0);
  if (used >= IMAGE_REGEN_LIMIT) {
    throw new QuotaError(
      `This post's image has already been regenerated ${used}/${IMAGE_REGEN_LIMIT} times - that's the limit. Upload your own image instead.`,
      "IMAGE_REGEN_LIMIT",
      { used, limit: IMAGE_REGEN_LIMIT }
    );
  }

  const ent = task.tenant_id ? await resolveEntitlements(task.tenant_id) : null;
  if (ent) {
    assertActive(ent);
    if (!ent.features.f_image_generation) {
      throw new QuotaError("AI image generation is not included in this plan", "FEATURE_LOCKED");
    }
    await assertCredits(task.tenant_id, await creditCostFor("image"));
  }

  const kb = await buildKnowledge(task.client_id);
  const ctx = {
    taskId,
    tenantId: task.tenant_id || null,
    imagesEnabled: ent ? Boolean(ent.features.f_image_generation) : true,
    seed: `${taskId}-imgregen-${used + 1}-${Date.now() % 100000}`,
  };

  const image = await generateImage(
    kb,
    { topic: task.topic || "", service: kb.services[0], concept: task.image_concept || task.topic || "" },
    ctx
  );

  if (!image.placeholder) await retireCurrentImage(task); // old image is being replaced - clean it out of storage
  await saveTaskImage(taskId, task.tenant_id || null, image);
  await update("ai_tasks", taskId, { image_regen_count: used + 1 });

  return { ok: true, taskId, image, regenCount: used + 1, limit: IMAGE_REGEN_LIMIT };
}

/**
 * Generates several independent image options for a task and leaves them as
 * pending candidates - ai_tasks.image_url is untouched until the reviewer
 * calls selectTaskImage(). Does NOT count against IMAGE_REGEN_LIMIT (that
 * cap is for the single-image "Regenerate" action); each option still costs
 * one image credit like any other generation.
 */
export async function generateTaskImageOptions(taskId, tenantId = null, count = IMAGE_OPTIONS_DEFAULT) {
  const task = await one(
    `SELECT * FROM ai_tasks WHERE id=?${tenantId ? " AND tenant_id=?" : ""}`,
    tenantId ? [taskId, tenantId] : [taskId]
  );
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (task.status === TASK_STATUS.PUBLISHED) {
    throw new Error("This post is already live on GMB - upload a replacement image instead so the change reaches Google.");
  }

  const n = Math.max(1, Math.min(Number(count) || IMAGE_OPTIONS_DEFAULT, IMAGE_OPTIONS_MAX));

  const ent = task.tenant_id ? await resolveEntitlements(task.tenant_id) : null;
  if (ent) {
    assertActive(ent);
    if (!ent.features.f_image_generation) {
      throw new QuotaError("AI image generation is not included in this plan", "FEATURE_LOCKED");
    }
    await assertCredits(task.tenant_id, (await creditCostFor("image")) * n);
  }

  const kb = await buildKnowledge(task.client_id);
  const ctx = {
    taskId,
    tenantId: task.tenant_id || null,
    imagesEnabled: ent ? Boolean(ent.features.f_image_generation) : true,
    seed: `${taskId}-imgopts-${Date.now() % 100000}`,
  };

  const images = await generateImageOptions(
    kb,
    { topic: task.topic || "", service: kb.services[0], concept: task.image_concept || task.topic || "" },
    ctx,
    n
  );

  const candidates = [];
  for (const image of images) {
    if (image.placeholder) continue; // a failed slot - don't offer a broken option to pick from
    const id = await addImageCandidate({
      taskId,
      tenantId: task.tenant_id || null,
      url: image.url,
      storageProvider: image.storageProvider || null,
      storageKey: image.storageKey || null,
      aiProvider: image.provider,
      prompt: image.prompt,
      status: "CANDIDATE",
    });
    candidates.push({ id, url: image.url, provider: image.provider });
  }

  if (!candidates.length) {
    throw new Error("Every image option failed to generate - check the AI execution log for the reason.");
  }

  return { ok: true, taskId, candidates, requested: n, generated: images.length, failed: images.length - candidates.length };
}

/**
 * Finalizes one pending candidate as the task's image: mirrors it onto
 * ai_tasks, deletes the PREVIOUS selected image (if any) from storage, and
 * deletes every OTHER pending candidate from that same generation batch from
 * storage too - only the picked one survives.
 */
export async function selectTaskImage(taskId, candidateId, tenantId = null) {
  const task = await one(
    `SELECT * FROM ai_tasks WHERE id=?${tenantId ? " AND tenant_id=?" : ""}`,
    tenantId ? [taskId, tenantId] : [taskId]
  );
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (task.status === TASK_STATUS.PUBLISHED) {
    throw new Error("This post is already live on GMB - upload a replacement image instead so the change reaches Google.");
  }

  const chosen = await getImageCandidate(candidateId, taskId);
  if (!chosen) throw new Error("Image option not found on this task");
  if (chosen.status === "DELETED") throw new Error("This image option was already deleted");

  if (chosen.status !== "SELECTED") {
    await retireCurrentImage(task); // drop the image that was live before this pick, if different
    await markCandidateSelected(chosen.id);
    await update("ai_tasks", taskId, {
      image_url: chosen.url,
      image_provider: chosen.ai_provider,
      image_storage_provider: chosen.storage_provider,
      image_storage_key: chosen.storage_key,
    });
  }

  const siblings = (await listPendingCandidates(taskId)).filter((c) => c.id !== chosen.id);
  for (const c of siblings) {
    if (c.storage_provider && c.storage_key) await deleteImage(c.storage_provider, c.storage_key);
    await markCandidateDeleted(c.id);
  }

  return { ok: true, taskId, selected: { id: chosen.id, url: chosen.url }, deleted: siblings.length };
}

/** Create a PENDING task from a calendar entry (or ad-hoc for a client). */
export async function createTask({ clientId, calendarId = null, postType = "Service", topic = null, scheduledDate = null, enforce = true }) {
  const client = await one("SELECT tenant_id, assigned_employee_id, active FROM clients WHERE id=?", [clientId]);
  if (!client) throw new Error("Client not found");
  if (enforce && client.tenant_id) {
    const ent = await resolveEntitlements(client.tenant_id);
    assertActive(ent);
    assertLimit(ent, "max_posts_month", 1);
    if (!client.active) throw new QuotaError("This client is inactive", "CLIENT_INACTIVE");
  }
  return insert("ai_tasks", {
    tenant_id: client.tenant_id,
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
export async function runNightlyJob({ date = null, clientId = null, tenantId = null, limit = 100 } = {}) {
  const targetDate = date || nextDay();
  const params = [targetDate];
  let sql = `SELECT c.* FROM content_calendar c
             JOIN clients cl ON cl.id=c.client_id AND cl.active=1
             JOIN tenants t ON t.id=cl.tenant_id AND t.status='ACTIVE'
             WHERE c.scheduled_date=? AND c.status='SCHEDULED'`;
  if (clientId) {
    sql += " AND c.client_id=?";
    params.push(clientId);
  }
  if (tenantId) {
    sql += " AND cl.tenant_id=?";
    params.push(tenantId);
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
        try {
          const taskId = await createTask({
            clientId: row.client_id,
            calendarId: row.id,
            postType: row.post_type,
            topic: row.topic,
            scheduledDate: row.scheduled_date,
          });
          const res = await runTaskPipeline(taskId);
          return { ...res, clientId: row.client_id, topic: row.topic };
        } catch (err) {
          await update("content_calendar", row.id, { status: "SKIPPED" });
          return {
            ok: false, taskId: null, clientId: row.client_id, topic: row.topic,
            status: "SKIPPED", error: err.message, code: err.code || "QUOTA",
            durationMs: 0,
          };
        }
      })
    );
    results.push(...batchResults);
  }

  const durations = results.map((r) => r.durationMs || 0);
  const summary = {
    date: targetDate,
    scheduled: rows.length,
    generated: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok && r.status !== "SKIPPED").length,
    skipped: results.filter((r) => r.status === "SKIPPED").length,
    credits: results.reduce((sum, r) => sum + Number(r.credits || 0), 0),
    ready: results.filter((r) => r.status === TASK_STATUS.READY_FOR_REVIEW).length,
    needsReview: results.filter((r) => r.status === TASK_STATUS.NEEDS_REVIEW).length,
    totalMs: Date.now() - startedAt,
    avgTaskMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    results,
  };

  // All tasks for the night are done -> email each affected tenant a table of
  // what happened, once, per the nightly run (not per task). Queued so this
  // never slows down or breaks the scheduler (see lib/mail/queue.js).
  await emailNightlySummaries(summary);

  return summary;
}

/**
 * Groups the night's results by tenant and queues one summary email per
 * tenant (to the tenant's billing/owner email), each with a table of every
 * client + post + status generated that night.
 */
async function emailNightlySummaries(summary) {
  if (!summary.results.length) return;
  try {
    const clientIds = [...new Set(summary.results.map((r) => r.clientId).filter(Boolean))];
    if (!clientIds.length) return;

    const clientRows = await query(
      `SELECT c.id AS client_id, c.business_name, c.tenant_id, t.company_email
         FROM clients c JOIN tenants t ON t.id=c.tenant_id
        WHERE c.id IN (${clientIds.map(() => "?").join(",")})`,
      clientIds
    );
    const clientMap = new Map(clientRows.map((c) => [c.client_id, c]));

    const taskIds = summary.results.map((r) => r.taskId).filter(Boolean);
    const taskTitles = taskIds.length
      ? await query(`SELECT id, title FROM ai_tasks WHERE id IN (${taskIds.map(() => "?").join(",")})`, taskIds)
      : [];
    const titleMap = new Map(taskTitles.map((t) => [t.id, t.title]));

    const byTenant = new Map();
    for (const r of summary.results) {
      const c = clientMap.get(r.clientId);
      if (!c || !c.company_email) continue;
      if (!byTenant.has(c.tenant_id)) byTenant.set(c.tenant_id, { email: c.company_email, rows: [], generated: 0, failed: 0, credits: 0 });
      const bucket = byTenant.get(c.tenant_id);
      bucket.rows.push({
        client: c.business_name,
        title: r.taskId ? titleMap.get(r.taskId) || r.topic : r.topic,
        status: r.ok ? r.status : r.status === "SKIPPED" ? "SKIPPED" : "FAILED",
        ok: !!r.ok,
      });
      if (r.ok) bucket.generated++;
      else bucket.failed++;
      bucket.credits += Number(r.credits || 0);
    }

    const tenantIds = [...byTenant.keys()];
    if (!tenantIds.length) return;
    const owners = await query(
      `SELECT tenant_id, name FROM users WHERE tenant_id IN (${tenantIds.map(() => "?").join(",")}) AND role='OWNER' AND active=1`,
      tenantIds
    );
    const ownerNameMap = new Map(owners.map((o) => [o.tenant_id, o.name]));

    for (const [tenantId, bucket] of byTenant.entries()) {
      const tpl = nightlySummaryEmail({
        ownerName: ownerNameMap.get(tenantId) || "there",
        date: summary.date,
        rows: bucket.rows,
        generated: bucket.generated,
        failed: bucket.failed,
        credits: bucket.credits,
        appUrl: process.env.APP_URL || null,
      });
      await queueEmail({ to: bucket.email, subject: tpl.subject, html: tpl.html, text: tpl.text, template: "nightly-summary", tenantId });
    }
  } catch (err) {
    console.error("[runNightlyJob] failed to queue nightly summary emails:", err.message);
  }
}

function nextDay() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
