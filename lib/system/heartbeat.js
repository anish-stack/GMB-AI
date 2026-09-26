import { query } from "../db.js";

/** Records that a background process ran (scheduler, mail worker, nightly job...). */
export async function beat(name, { ok = true, message = null } = {}) {
  try {
    await query(
      `INSERT INTO system_heartbeats (name, last_run_at, last_ok_at, status, message)
       VALUES (?, NOW(), ${ok ? "NOW()" : "NULL"}, ?, ?)
       ON DUPLICATE KEY UPDATE last_run_at=NOW(), ${ok ? "last_ok_at=NOW()," : ""} status=VALUES(status), message=VALUES(message)`,
      [name, ok ? "OK" : "FAILED", message ? String(message).slice(0, 480) : null],
    );
  } catch {
    /* table may not exist before migration */
  }
}

export async function heartbeats() {
  try {
    return await query("SELECT * FROM system_heartbeats");
  } catch {
    return [];
  }
}
