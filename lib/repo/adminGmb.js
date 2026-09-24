import "server-only";
import { query, one } from "@/lib/db";
import { getTask, deletePublishedPost, logAction } from "@/lib/repo/tasks.js";
import { deleteImage } from "@/lib/storage/index.js";
import { TASK_STATUS } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const PER_PAGE_OPTIONS = [25, 50, 100];

function int(v, def = null) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
function str(v) {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.trim() : "";
}
function isoDate(v) {
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}
function paging(sp) {
  const perPage = PER_PAGE_OPTIONS.includes(int(str(sp.per))) ? int(str(sp.per)) : 25;
  const page = Math.max(1, int(str(sp.page), 1));
  return { perPage, page, offset: (page - 1) * perPage };
}

/* ------------------------------------------------------------------ */
/* GMB POSTINGS (ai_tasks + gmb_posts)                                 */
/* ------------------------------------------------------------------ */
const POST_SORTS = {
  newest: "t.created_at DESC",
  oldest: "t.created_at ASC",
  scheduled_desc: "t.scheduled_date DESC, t.id DESC",
  scheduled_asc: "t.scheduled_date ASC, t.id ASC",
  published_desc: "COALESCE(p.published_at, t.published_at) DESC, t.id DESC",
  qa_high: "t.qa_score DESC, t.id DESC",
  qa_low: "t.qa_score ASC, t.id DESC",
  credits_high: "t.credits_used DESC, t.id DESC",
  updated: "t.updated_at DESC",
};
const DATE_FIELDS = { created: "t.created_at", scheduled: "t.scheduled_date", published: "COALESCE(p.published_at, t.published_at)", updated: "t.updated_at" };

export function readPostFilters(sp = {}) {
  return {
    q: str(sp.q),
    tenant: int(str(sp.tenant)),
    client: int(str(sp.client)),
    status: str(sp.status),
    type: str(sp.type),
    qa: str(sp.qa), // PASS | REVIEW | NONE
    image: str(sp.image), // yes | no
    publish: str(sp.publish), // mock | live | none
    dup: str(sp.dup), // yes
    dateField: DATE_FIELDS[str(sp.df)] ? str(sp.df) : "created",
    from: isoDate(sp.from),
    to: isoDate(sp.to),
    sort: POST_SORTS[str(sp.sort)] ? str(sp.sort) : "newest",
    ...paging(sp),
  };
}

function postWhere(f, { skipStatus = false } = {}) {
  const w = ["1=1"];
  const p = [];
  if (f.q) {
    const like = `%${f.q}%`;
    w.push("(t.title LIKE ? OR t.topic LIKE ? OR t.primary_keyword LIKE ? OR t.description LIKE ? OR c.business_name LIKE ? OR CAST(t.id AS CHAR) = ?)");
    p.push(like, like, like, like, like, f.q);
  }
  if (f.tenant) { w.push("t.tenant_id = ?"); p.push(f.tenant); }
  if (f.client) { w.push("t.client_id = ?"); p.push(f.client); }
  if (f.status && !skipStatus) { w.push("t.status = ?"); p.push(f.status); }
  if (f.type) { w.push("t.post_type = ?"); p.push(f.type); }
  if (f.qa === "PASS") w.push("t.qa_score >= 80");
  if (f.qa === "REVIEW") w.push("t.qa_score IS NOT NULL AND t.qa_score < 80");
  if (f.qa === "NONE") w.push("t.qa_score IS NULL");
  if (f.image === "yes") w.push("t.image_url IS NOT NULL AND t.image_url <> '' AND t.image_url NOT LIKE 'data:%'");
  if (f.image === "no") w.push("(t.image_url IS NULL OR t.image_url = '' OR t.image_url LIKE 'data:%')");
  if (f.publish === "mock") w.push("p.id IS NOT NULL AND p.is_mock = 1");
  if (f.publish === "live") w.push("p.id IS NOT NULL AND p.is_mock = 0");
  if (f.publish === "none") w.push("p.id IS NULL");
  if (f.dup === "yes") w.push("t.duplicate_of IS NOT NULL");
  const col = DATE_FIELDS[f.dateField];
  if (f.from) { w.push(`DATE(${col}) >= ?`); p.push(f.from); }
  if (f.to) { w.push(`DATE(${col}) <= ?`); p.push(f.to); }
  return { sql: w.join(" AND "), params: p };
}

const POST_FROM = `
  FROM ai_tasks t
  JOIN clients c ON c.id = t.client_id
  JOIN tenants tn ON tn.id = t.tenant_id
  LEFT JOIN (
    SELECT gp.* FROM gmb_posts gp
    JOIN (SELECT task_id, MAX(id) AS id FROM gmb_posts WHERE task_id IS NOT NULL GROUP BY task_id) last ON last.id = gp.id
  ) p ON p.task_id = t.id
  LEFT JOIN employees e ON e.id = t.assigned_employee_id
  LEFT JOIN users u ON u.id = e.user_id`;

export async function listAdminPosts(f) {
  const { sql, params } = postWhere(f);
  const statusScope = postWhere(f, { skipStatus: true });

  const [rows, total, byStatus, sums] = await Promise.all([
    query(
      `SELECT t.id, t.tenant_id, t.client_id, t.status, t.post_type, t.scheduled_date, t.topic, t.title,
              t.description, t.cta, t.primary_keyword, t.secondary_keywords, t.hashtags, t.image_url,
              t.image_provider, t.image_storage_provider, t.qa_score, t.qa_status, t.duplicate_score,
              t.duplicate_of, t.regenerate_count, t.image_regen_count, t.credits_used, t.error_message,
              t.created_at, t.updated_at, COALESCE(p.published_at, t.published_at) AS published_at,
              c.business_name AS client_name, c.city AS client_city, c.business_category,
              tn.name AS tenant_name, u.name AS employee_name,
              p.id AS post_id, p.is_mock, p.provider AS publish_provider, p.external_id, p.status AS post_status
       ${POST_FROM}
       WHERE ${sql}
       ORDER BY ${POST_SORTS[f.sort]}
       LIMIT ${f.perPage} OFFSET ${f.offset}`,
      params
    ),
    one(`SELECT COUNT(*) AS n ${POST_FROM} WHERE ${sql}`, params),
    query(`SELECT t.status, COUNT(*) AS n ${POST_FROM} WHERE ${statusScope.sql} GROUP BY t.status`, statusScope.params),
    one(
      `SELECT COALESCE(SUM(t.credits_used),0) AS credits, ROUND(AVG(t.qa_score)) AS avg_qa,
              SUM(p.id IS NOT NULL) AS published_rows
       ${POST_FROM} WHERE ${sql}`,
      params
    ),
  ]);

  return {
    rows,
    total: Number(total?.n || 0),
    statusCounts: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])),
    summary: {
      credits: Number(sums?.credits || 0),
      avgQa: sums?.avg_qa == null ? null : Number(sums.avg_qa),
      published: Number(sums?.published_rows || 0),
    },
  };
}

export async function postFilterOptions({ tenant } = {}) {
  const [tenants, clients, types] = await Promise.all([
    query("SELECT id, name FROM tenants ORDER BY name"),
    tenant
      ? query("SELECT id, business_name AS name FROM clients WHERE tenant_id = ? ORDER BY business_name", [tenant])
      : query("SELECT c.id, CONCAT(c.business_name, ' - ', t.name) AS name FROM clients c JOIN tenants t ON t.id=c.tenant_id ORDER BY c.business_name"),
    query("SELECT DISTINCT post_type AS v FROM ai_tasks WHERE post_type IS NOT NULL AND post_type <> '' ORDER BY post_type"),
  ]);
  return { tenants, clients, types: types.map((r) => r.v) };
}

/* ------------------------------------------------------------------ */
/* GMB PROFILES                                                        */
/* ------------------------------------------------------------------ */
const PROFILE_SORTS = {
  newest: "g.created_at DESC",
  oldest: "g.created_at ASC",
  name: "g.location_name ASC",
  rating_high: "g.rating DESC, g.review_count DESC",
  rating_low: "g.rating ASC",
  reviews: "g.review_count DESC",
  synced: "g.last_synced_at DESC",
  posts: "total_posts DESC",
  last_post: "last_post_at DESC",
};

export function readProfileFilters(sp = {}) {
  const rating = Number.parseFloat(str(sp.rating));
  return {
    q: str(sp.q),
    tenant: int(str(sp.tenant)),
    conn: str(sp.conn),
    provider: str(sp.provider),
    category: str(sp.category),
    city: str(sp.city),
    rating: Number.isFinite(rating) ? rating : null,
    sync: str(sp.sync), // never | stale | fresh
    google: str(sp.google), // yes | no
    posts: str(sp.posts), // yes | no | idle30
    clientActive: str(sp.active), // 1 | 0
    sort: PROFILE_SORTS[str(sp.sort)] ? str(sp.sort) : "newest",
    ...paging(sp),
  };
}

const PROFILE_FROM = `
  FROM gmb_profiles g
  JOIN clients c ON c.id = g.client_id
  JOIN tenants tn ON tn.id = g.tenant_id
  LEFT JOIN (
    SELECT client_id,
           COUNT(*) AS total_posts,
           SUM(status = 'PUBLISHED') AS published_posts,
           SUM(status IN ('READY_FOR_REVIEW','NEEDS_REVIEW')) AS pending_posts,
           SUM(status = 'FAILED') AS failed_posts,
           MAX(COALESCE(published_at, created_at)) AS last_post_at
    FROM ai_tasks GROUP BY client_id
  ) s ON s.client_id = g.client_id`;

function profileWhere(f, { skipConn = false } = {}) {
  const w = ["1=1"];
  const p = [];
  if (f.q) {
    const like = `%${f.q}%`;
    w.push("(g.location_name LIKE ? OR c.business_name LIKE ? OR g.address LIKE ? OR g.phone LIKE ? OR c.google_email LIKE ? OR g.website LIKE ?)");
    p.push(like, like, like, like, like, like);
  }
  if (f.tenant) { w.push("g.tenant_id = ?"); p.push(f.tenant); }
  if (f.conn && !skipConn) { w.push("g.connection_status = ?"); p.push(f.conn); }
  if (f.provider) { w.push("g.provider = ?"); p.push(f.provider); }
  if (f.category) { w.push("COALESCE(g.category, c.business_category) = ?"); p.push(f.category); }
  if (f.city) { w.push("c.city = ?"); p.push(f.city); }
  if (f.rating != null) { w.push("g.rating >= ?"); p.push(f.rating); }
  if (f.sync === "never") w.push("g.last_synced_at IS NULL");
  if (f.sync === "stale") w.push("g.last_synced_at < NOW() - INTERVAL 7 DAY");
  if (f.sync === "fresh") w.push("g.last_synced_at >= NOW() - INTERVAL 7 DAY");
  if (f.google === "yes") w.push("c.google_refresh_token IS NOT NULL");
  if (f.google === "no") w.push("c.google_refresh_token IS NULL");
  if (f.posts === "yes") w.push("COALESCE(s.total_posts,0) > 0");
  if (f.posts === "no") w.push("COALESCE(s.total_posts,0) = 0");
  if (f.posts === "idle30") w.push("(s.last_post_at IS NULL OR s.last_post_at < NOW() - INTERVAL 30 DAY)");
  if (f.clientActive === "1" || f.clientActive === "0") { w.push("c.active = ?"); p.push(Number(f.clientActive)); }
  return { sql: w.join(" AND "), params: p };
}

export async function listAdminProfiles(f) {
  const { sql, params } = profileWhere(f);
  const connScope = profileWhere(f, { skipConn: true });

  const [rows, total, byConn, sums] = await Promise.all([
    query(
      `SELECT g.id, g.tenant_id, g.client_id, g.location_name, COALESCE(g.category, c.business_category) AS category,
              g.address, g.phone, g.website, g.map_url, g.rating, g.review_count, g.connection_status, g.provider,
              g.last_synced_at, g.created_at, c.business_name AS client_name, c.city, c.active AS client_active,
              c.google_email, c.google_refresh_token IS NOT NULL AS google_linked, c.posting_frequency,
              tn.name AS tenant_name,
              COALESCE(s.total_posts,0) AS total_posts, COALESCE(s.published_posts,0) AS published_posts,
              COALESCE(s.pending_posts,0) AS pending_posts, COALESCE(s.failed_posts,0) AS failed_posts, s.last_post_at
       ${PROFILE_FROM}
       WHERE ${sql}
       ORDER BY ${PROFILE_SORTS[f.sort]}
       LIMIT ${f.perPage} OFFSET ${f.offset}`,
      params
    ),
    one(`SELECT COUNT(*) AS n ${PROFILE_FROM} WHERE ${sql}`, params),
    query(`SELECT g.connection_status AS k, COUNT(*) AS n ${PROFILE_FROM} WHERE ${connScope.sql} GROUP BY g.connection_status`, connScope.params),
    one(
      `SELECT ROUND(AVG(g.rating),2) AS avg_rating, COALESCE(SUM(g.review_count),0) AS reviews,
              COALESCE(SUM(s.published_posts),0) AS published, SUM(g.last_synced_at IS NULL) AS never_synced
       ${PROFILE_FROM} WHERE ${sql}`,
      params
    ),
  ]);

  return {
    rows,
    total: Number(total?.n || 0),
    connCounts: Object.fromEntries(byConn.map((r) => [r.k, Number(r.n)])),
    summary: {
      avgRating: sums?.avg_rating == null ? null : Number(sums.avg_rating),
      reviews: Number(sums?.reviews || 0),
      published: Number(sums?.published || 0),
      neverSynced: Number(sums?.never_synced || 0),
    },
  };
}

export async function profileFilterOptions() {
  const [tenants, conns, providers, categories, cities] = await Promise.all([
    query("SELECT id, name FROM tenants ORDER BY name"),
    query("SELECT DISTINCT connection_status AS v FROM gmb_profiles ORDER BY v"),
    query("SELECT DISTINCT provider AS v FROM gmb_profiles ORDER BY v"),
    query(
      `SELECT DISTINCT COALESCE(g.category, c.business_category) AS v
         FROM gmb_profiles g JOIN clients c ON c.id=g.client_id
        WHERE COALESCE(g.category, c.business_category) IS NOT NULL ORDER BY v`
    ),
    query(
      `SELECT DISTINCT c.city AS v FROM gmb_profiles g JOIN clients c ON c.id=g.client_id
        WHERE c.city IS NOT NULL AND c.city <> '' ORDER BY v`
    ),
  ]);
  const pick = (r) => r.map((x) => x.v).filter(Boolean);
  return { tenants, conns: pick(conns), providers: pick(providers), categories: pick(categories), cities: pick(cities) };
}

/* ------------------------------------------------------------------ */
/* SUPER ADMIN WRITE ACTIONS                                           */
/* ------------------------------------------------------------------ */

/**
 * Permanently delete a GMB post/task. If it is live on GMB it is removed from
 * the provider first; `force` skips a failing remote delete and removes it
 * locally anyway. Stored images (task + all candidates) are cleaned up.
 */
export async function hardDeleteTask(taskId, session, { force = false } = {}) {
  const task = await getTask(taskId);
  if (!task) {
    const err = new Error("Task not found");
    err.status = 404;
    throw err;
  }

  let remote = null;
  if (task.status === TASK_STATUS.PUBLISHED && task.post?.external_id && task.post.status !== "DELETED") {
    try {
      remote = await deletePublishedPost(taskId, session);
    } catch (err) {
      if (!force) {
        const e = new Error(`Could not delete the live post from GMB: ${err.message}`);
        e.status = 409;
        e.code = "REMOTE_DELETE_FAILED";
        throw e;
      }
      remote = { ok: false, error: err.message };
    }
  }

  const candidates = await query(
    "SELECT storage_provider, storage_key FROM task_image_candidates WHERE task_id=? AND status<>'DELETED' AND storage_key IS NOT NULL",
    [taskId]
  );
  const seen = new Set();
  const files = [
    ...(task.image_storage_provider && task.image_storage_key ? [{ p: task.image_storage_provider, k: task.image_storage_key }] : []),
    ...candidates.map((c) => ({ p: c.storage_provider, k: c.storage_key })),
  ].filter((f) => f.p && f.k && !seen.has(`${f.p}:${f.k}`) && seen.add(`${f.p}:${f.k}`));
  for (const f of files) await deleteImage(f.p, f.k);

  await query("DELETE FROM gmb_posts WHERE task_id=?", [taskId]);
  await query("DELETE FROM ai_tasks WHERE id=?", [taskId]);
  return { ok: true, id: taskId, tenantId: task.tenant_id, remote, imagesDeleted: files.length };
}

/** Force a task into any status (super admin override). */
export async function setTaskStatus(taskId, status, session, note = null) {
  if (!TASK_STATUS[status]) throw new Error(`Unknown status: ${status}`);
  const row = await one("SELECT id, status FROM ai_tasks WHERE id=?", [taskId]);
  if (!row) {
    const err = new Error("Task not found");
    err.status = 404;
    throw err;
  }
  const patch = [status];
  let extra = "";
  if (status === TASK_STATUS.PUBLISHED) extra = ", published_at=COALESCE(published_at, NOW())";
  await query(`UPDATE ai_tasks SET status=?${extra} WHERE id=?`, [...patch, taskId]);
  await logAction(taskId, session, "STATUS_OVERRIDE", note || `Super admin: ${row.status} → ${status}`);
  return { ok: true, from: row.status, to: status };
}
