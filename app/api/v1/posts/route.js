import { after } from "next/server";
import { publicApi, pageParams, badRequest, notFound } from "@/lib/api/public.js";
import { query, one } from "@/lib/db";
import { postOut } from "@/lib/api/serializers.js";
import { createTask, runTaskPipeline } from "@/lib/ai/orchestrator.js";
import { POST_TYPES } from "@/lib/constants.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STATUSES = ["PENDING", "READY_FOR_REVIEW", "NEEDS_REVIEW", "APPROVED", "REJECTED", "PUBLISHED", "FAILED"];

/** GET /api/v1/posts?client_id=&status=&page=&limit= */
export const GET = publicApi({ scope: "posts:read", endpoint: "posts.list" }, async ({ request, tenantId }) => {
  const { sp, limit, offset, page } = pageParams(request);
  const where = ["tenant_id=?"];
  const params = [tenantId];
  if (sp.get("client_id")) {
    where.push("client_id=?");
    params.push(Number(sp.get("client_id")));
  }
  const status = (sp.get("status") || "").toUpperCase();
  if (status) {
    if (!STATUSES.includes(status)) throw badRequest(`status must be one of ${STATUSES.join(", ")}`);
    where.push("status=?");
    params.push(status);
  }
  const [rows, [{ n }]] = await Promise.all([
    query(`SELECT * FROM ai_tasks WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) n FROM ai_tasks WHERE ${where.join(" AND ")}`, params),
  ]);
  return { items: rows.map(postOut), page, limit, total: Number(n) };
});

/**
 * POST /api/v1/posts  { client_id, topic?, post_type?, scheduled_date?, generate? }
 * Counts against the client's posting plan (weekly + total caps) exactly like the app.
 * generate=true starts AI generation in the background; poll GET /api/v1/posts/:id.
 */
export const POST = publicApi({ scope: "posts:write", endpoint: "posts.create" }, async ({ request, tenantId, key }) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") throw badRequest("JSON body required");
  const clientId = Number(body.client_id);
  if (!clientId) throw badRequest("client_id is required");
  const client = await one("SELECT id, active FROM clients WHERE id=? AND tenant_id=?", [clientId, tenantId]);
  if (!client) throw notFound("Client not found");
  const postType = body.post_type ? String(body.post_type) : "Service";
  if (POST_TYPES && !POST_TYPES.includes(postType)) throw badRequest(`post_type must be one of ${POST_TYPES.join(", ")}`);
  const date = body.scheduled_date ? String(body.scheduled_date) : new Date().toLocaleDateString("en-CA");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("scheduled_date must be YYYY-MM-DD");
  const topic = body.topic ? String(body.topic).trim().slice(0, 200) : null;

  const taskId = await createTask({ clientId, postType, topic, scheduledDate: date, source: "api" });
  await audit({ tenantId, session: { name: `api:${key.key_prefix}` } }, "API_POST_CREATED", { entity: "task", entityId: taskId, meta: { clientId, date } });
  if (body.generate !== false) after(() => runTaskPipeline(taskId).catch(() => {}));
  const task = await one("SELECT * FROM ai_tasks WHERE id=?", [taskId]);
  return { __status: 201, ...postOut(task), generation: body.generate !== false ? "started" : "not_started" };
});
