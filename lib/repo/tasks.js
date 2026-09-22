import { query, one, insert, update, parseJson } from "../db.js";
import { TASK_STATUS } from "../constants.js";
import { getGMBProvider } from "../gmb/provider.js";
import { incrementUsage } from "../saas/usage.js";
import { METRICS } from "../saas/constants.js";
import { toPublicUrl } from "../utils.js";

export function hydrate(row) {
  if (!row) return null;
  return {
    ...row,
    research: parseJson(row.research, null),
    keyword_data: parseJson(row.keyword_data, null),
    secondary_keywords: parseJson(row.secondary_keywords, []),
    hashtags: parseJson(row.hashtags, []),
    duplicate_score: Number(row.duplicate_score || 0),
  };
}

export async function listTasks({ status = null, clientId = null, date = null, limit = 100, tenantId = null } = {}) {
  const where = [];
  const params = [];
  if (tenantId) { where.push("t.tenant_id=?"); params.push(tenantId); }
  if (status) {
    if (Array.isArray(status)) {
      where.push(`t.status IN (${status.map(() => "?").join(",")})`);
      params.push(...status);
    } else {
      where.push("t.status=?");
      params.push(status);
    }
  }
  if (clientId) { where.push("t.client_id=?"); params.push(clientId); }
  if (date) { where.push("DATE(t.created_at)=?"); params.push(date); }

  const rows = await query(
    `SELECT t.*, c.business_name, c.city, c.business_category
       FROM ai_tasks t JOIN clients c ON c.id=t.client_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY t.updated_at DESC LIMIT ${Number(limit)}`,
    params
  );
  return rows.map(hydrate);
}

export async function getTask(id, tenantId = null) {
  const row = await one(
    `SELECT t.*, c.business_name, c.city, c.state, c.business_category, c.phone, c.website,
            c.gmb_location_id, c.content_tone, c.preferred_language
       FROM ai_tasks t JOIN clients c ON c.id=t.client_id
      WHERE t.id=?${tenantId ? " AND t.tenant_id=?" : ""}`,
    tenantId ? [id, tenantId] : [id]
  );
  if (!row) return null;
  const task = hydrate(row);
  task.review = await one("SELECT * FROM ai_reviews WHERE task_id=? ORDER BY id DESC LIMIT 1", [id]);
  if (task.review) {
    task.review.checks = parseJson(task.review.checks, {});
    task.review.issues = parseJson(task.review.issues, []);
    task.review.warnings = parseJson(task.review.warnings, []);
  }
  task.executions = await query("SELECT * FROM ai_executions WHERE task_id=? ORDER BY id ASC", [id]);
  task.timeline = await query("SELECT * FROM employee_approvals WHERE task_id=? ORDER BY id ASC", [id]);
  task.post = await one("SELECT * FROM gmb_posts WHERE task_id=? ORDER BY id DESC LIMIT 1", [id]);
  task.imageCandidates = await query(
    "SELECT id, url, ai_provider, created_at FROM task_image_candidates WHERE task_id=? AND status='CANDIDATE' ORDER BY id ASC",
    [id]
  );
  return task;
}

export async function assertTaskInTenant(taskId, tenantId) {
  if (!tenantId) return true;
  const row = await one("SELECT id FROM ai_tasks WHERE id=? AND tenant_id=?", [taskId, tenantId]);
  if (!row) {
    const err = new Error("Task not found");
    err.status = 404;
    throw err;
  }
  return true;
}

export async function logAction(taskId, session, action, notes = null) {
  await insert("employee_approvals", {
    task_id: taskId,
    employee_id: session?.employeeId || null,
    user_name: session?.name || "system",
    action,
    notes,
  });
}

export async function editTask(taskId, session, fields, tenantId = null) {
  await assertTaskInTenant(taskId, tenantId);
  const current = await one("SELECT status FROM ai_tasks WHERE id=?", [taskId]);
  if (current?.status === TASK_STATUS.PUBLISHED) {
    throw new Error('This post is already live on GMB - use "Edit live post" instead so the change reaches Google.');
  }
  const allowed = [
    "title", "description", "cta", "primary_keyword", "topic",
    "post_type", "image_concept", "image_url", "image_provider", "scheduled_date",
  ];
  const patch = {};
  for (const k of allowed) if (fields[k] !== undefined) patch[k] = fields[k];
  if (Array.isArray(fields.hashtags)) patch.hashtags = fields.hashtags;
  if (Array.isArray(fields.secondary_keywords)) patch.secondary_keywords = fields.secondary_keywords;
  if (!Object.keys(patch).length) return;
  await update("ai_tasks", taskId, patch);
  await logAction(taskId, session, "EDITED", "Employee edited the AI content");
}

export async function approveTask(taskId, session, tenantId = null) {
  await assertTaskInTenant(taskId, tenantId);
  await update("ai_tasks", taskId, { status: TASK_STATUS.APPROVED });
  await logAction(taskId, session, "APPROVED");
}

export async function rejectTask(taskId, session, reason, tenantId = null) {
  await assertTaskInTenant(taskId, tenantId);
  await update("ai_tasks", taskId, { status: TASK_STATUS.REJECTED });
  await logAction(taskId, session, "REJECTED", reason || null);
}

/**
 * Publish through the configured GMB provider.
 * With GMB_PROVIDER=mock this is a simulation - nothing reaches Google.
 */
export async function publishTask(taskId, session, tenantId = null) {
  await assertTaskInTenant(taskId, tenantId);
  const task = await getTask(taskId);
  if (!task) throw new Error("Task not found");
  if (![TASK_STATUS.APPROVED, TASK_STATUS.READY_FOR_REVIEW].includes(task.status)) {
    throw new Error(`Task must be approved before publishing (current: ${task.status})`);
  }

  const provider = getGMBProvider();
  const publicImageUrl = toPublicUrl(task.image_url);
  const result = await provider.createPost(task.client_id, {
    task_id: task.id,
    tenant_id: task.tenant_id,
    title: task.title,
    description: task.description,
    cta: task.cta,
    image_url: task.image_url,
    public_image_url: publicImageUrl,
    post_type: task.post_type,
  });

  if (task.image_url && !publicImageUrl && !provider.isMock) {
    await logAction(
      taskId,
      session,
      "IMAGE_SKIPPED",
      task.image_url.startsWith("data:")
        ? "Post published without image: it was still a placeholder (AI generation never succeeded for this task)"
        : "Post published without image: APP_URL is not set in .env, so Google could not fetch it"
    );
  }

  const keywords = [task.primary_keyword, ...(task.secondary_keywords || [])].filter(Boolean);
  for (const kw of keywords) {
    const existing = await one("SELECT id FROM keywords WHERE client_id=? AND keyword=? LIMIT 1", [task.client_id, kw]);
    await insert("gmb_post_keywords", {
      post_id: result.id,
      keyword_id: existing ? existing.id : null,
      keyword: kw,
      kw_type: kw === task.primary_keyword ? "PRIMARY" : "SECONDARY",
    });
  }

  await update("ai_tasks", taskId, { status: TASK_STATUS.PUBLISHED, published_at: new Date() });
  await logAction(taskId, session, "PUBLISHED", provider.isMock ? "Mock publish (prototype)" : "Live publish");
  await incrementUsage(task.tenant_id, METRICS.POSTS_PUBLISHED, 1);

  if (provider.isMock) {
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      await insert("gmb_performance", {
        tenant_id: task.tenant_id,
        client_id: task.client_id,
        post_id: result.id,
        stat_date: d.toISOString().slice(0, 10),
        views: 40 + Math.floor(Math.random() * 120),
        clicks: 3 + Math.floor(Math.random() * 20),
        calls: Math.floor(Math.random() * 8),
        direction_requests: Math.floor(Math.random() * 10),
        is_mock: 1,
      });
    }
  }

  return { ...result, is_mock: provider.isMock, provider: provider.name };
}

/**
 * Edit a post that's already live on GMB. Applies the given fields to the task
 * and gmb_posts rows, then pushes the update to the same provider (Google or
 * mock) that published it. Lets a reviewer fix a typo or swap the image
 * (including a manual upload) without deleting and re-publishing.
 */
const LIVE_POST_FIELDS = ["title", "description", "cta", "post_type", "image_url"];
const LIVE_TASK_FIELDS = [...LIVE_POST_FIELDS, "image_provider"];

export async function updatePublishedPost(taskId, session, fields = {}, tenantId = null) {
  await assertTaskInTenant(taskId, tenantId);
  const task = await getTask(taskId, tenantId);
  if (!task) throw new Error("Task not found");
  if (task.status !== TASK_STATUS.PUBLISHED) throw new Error("This task has no live post to edit");
  const post = task.post;
  if (!post || !post.external_id) throw new Error("This post has no reference to update on Google");
  if (post.status === "DELETED") throw new Error("This post was already deleted");

  const patch = {};
  for (const k of LIVE_TASK_FIELDS) if (fields[k] !== undefined) patch[k] = fields[k];
  if (!Object.keys(patch).length) return { ok: true, unchanged: true };

  const merged = { ...post, ...patch };
  const provider = getGMBProvider();
  const publicImageUrl = toPublicUrl(merged.image_url);

  await provider.updatePost(task.client_id, post.external_id, {
    title: merged.title,
    description: merged.description,
    cta: merged.cta,
    post_type: merged.post_type,
    image_url: merged.image_url,
    public_image_url: publicImageUrl,
  });

  const postPatch = {};
  for (const k of LIVE_POST_FIELDS) if (patch[k] !== undefined) postPatch[k] = patch[k];
  if (Object.keys(postPatch).length) await update("gmb_posts", post.id, postPatch);
  await update("ai_tasks", taskId, patch);

  if (patch.image_url && !publicImageUrl && !provider.isMock) {
    await logAction(
      taskId,
      session,
      "IMAGE_SKIPPED",
      patch.image_url.startsWith("data:")
        ? "Post updated without changing the image: it's still a placeholder (AI generation never succeeded)"
        : "Post updated without changing the image: APP_URL is not set in .env, so Google could not fetch it"
    );
  }

  await logAction(taskId, session, "POST_EDITED", provider.isMock ? "Mock update (prototype)" : "Live post updated on Google");
  return { ok: true, is_mock: provider.isMock, provider: provider.name };
}

/**
 * Delete a post that's already live on GMB. Removes it from Google (or the
 * mock store) and marks the task/post so it can't be edited or re-deleted.
 */
export async function deletePublishedPost(taskId, session, tenantId = null) {
  await assertTaskInTenant(taskId, tenantId);
  const task = await getTask(taskId, tenantId);
  if (!task) throw new Error("Task not found");
  if (task.status !== TASK_STATUS.PUBLISHED) throw new Error("This task has no live post to delete");
  const post = task.post;
  if (!post || !post.external_id) throw new Error("This post has no reference to delete on Google");
  if (post.status === "DELETED") throw new Error("This post was already deleted");

  const provider = getGMBProvider();
  await provider.deletePost(task.client_id, post.external_id);

  await update("gmb_posts", post.id, { status: "DELETED" });
  await update("ai_tasks", taskId, { status: TASK_STATUS.POST_DELETED });
  await logAction(taskId, session, "POST_DELETED", provider.isMock ? "Mock delete (prototype)" : "Live post deleted from Google");
  return { ok: true, is_mock: provider.isMock, provider: provider.name };
}
