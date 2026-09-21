import { one } from "../db.js";

const cache = new Map();

/** clientId -> tenant_id, memoised (tenant of a client never changes). */
export async function tenantOfClient(clientId) {
  if (!clientId) return null;
  const key = Number(clientId);
  if (cache.has(key)) return cache.get(key);
  const row = await one("SELECT tenant_id FROM clients WHERE id=?", [key]);
  const tid = row ? row.tenant_id : null;
  if (tid) cache.set(key, tid);
  return tid;
}

export async function tenantOfTask(taskId) {
  if (!taskId) return null;
  const row = await one("SELECT tenant_id FROM ai_tasks WHERE id=?", [taskId]);
  return row ? row.tenant_id : null;
}

export function clearTenantCache() {
  cache.clear();
}
