import "server-only";
import { query, one, insert, update } from "../db.js";

/** Insert one generated (or uploaded) image as a candidate row. */
export async function addImageCandidate({
  taskId,
  tenantId = null,
  url,
  storageProvider = null,
  storageKey = null,
  aiProvider = null,
  aiModel = null,
  prompt = null,
  status = "CANDIDATE",
  contentHash = null,
}) {
  return insert("task_image_candidates", {
    task_id: taskId,
    tenant_id: tenantId,
    url,
    storage_provider: storageProvider,
    storage_key: storageKey,
    ai_provider: aiProvider,
    ai_model: aiModel,
    prompt,
    status,
    content_hash: contentHash,
  });
}

/** Hashes of images already used (selected/candidate) for this client's other tasks,
 * newest first - used to catch the AI handing back a picture it already generated. */
export async function getRecentImageHashes(clientId, { excludeTaskId = null, limit = 20 } = {}) {
  const rows = await query(
    `SELECT c.content_hash FROM task_image_candidates c
       JOIN ai_tasks t ON t.id = c.task_id
      WHERE t.client_id = ? AND c.content_hash IS NOT NULL AND c.status <> 'DELETED'
        AND (? IS NULL OR c.task_id <> ?)
      ORDER BY c.id DESC LIMIT ?`,
    [clientId, excludeTaskId, excludeTaskId, limit]
  );
  return rows.map((r) => r.content_hash);
}

/** Pending options from a "generate N images, pick one" run - not yet chosen, not deleted. */
export async function listPendingCandidates(taskId) {
  return query(
    "SELECT * FROM task_image_candidates WHERE task_id=? AND status='CANDIDATE' ORDER BY id ASC",
    [taskId]
  );
}

/** Full history for a task (candidates + the selected one + soft-deleted rows), newest first. */
export async function listAllCandidates(taskId) {
  return query("SELECT * FROM task_image_candidates WHERE task_id=? ORDER BY id DESC", [taskId]);
}

export async function getImageCandidate(id, taskId) {
  return one("SELECT * FROM task_image_candidates WHERE id=? AND task_id=?", [id, taskId]);
}

export async function getSelectedCandidate(taskId) {
  return one("SELECT * FROM task_image_candidates WHERE task_id=? AND status='SELECTED' ORDER BY id DESC LIMIT 1", [taskId]);
}

export async function markCandidateSelected(id) {
  await update("task_image_candidates", id, { status: "SELECTED" });
}

export async function markCandidateDeleted(id) {
  await query("UPDATE task_image_candidates SET status='DELETED', deleted_at=NOW() WHERE id=?", [id]);
}

/** Rows never soft-deleted, older than `days` - used by the 90-day retention sweep. */
export async function listStaleCandidates(days, { excludeStatuses = ["DELETED"] } = {}) {
  const placeholders = excludeStatuses.map(() => "?").join(",");
  return query(
    `SELECT c.*, t.status AS task_status
       FROM task_image_candidates c
       JOIN ai_tasks t ON t.id=c.task_id
      WHERE c.status NOT IN (${placeholders})
        AND c.created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [...excludeStatuses, days]
  );
}
