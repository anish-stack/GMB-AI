import { query, one, insert, update, parseJson } from "../db.js";
import { TASK_STATUS } from "../constants.js";
import { getGMBProvider } from "../gmb/provider.js";
import { incrementUsage } from "../saas/usage.js";
import { METRICS } from "../saas/constants.js";

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
  const result = await provider.createPost(task.client_id, {
    task_id: task.id,
    tenant_id: task.tenant_id,
    title: task.title,
    description: task.description,
    cta: task.cta,
    image_url: task.image_url,
    post_type: task.post_type,
  });

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
