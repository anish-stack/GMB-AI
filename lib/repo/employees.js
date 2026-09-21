import { query } from "@/lib/db";

export async function listEmployeesForAssignment(tenantId = null) {
  return query(
    `SELECT e.id, u.name FROM employees e JOIN users u ON u.id=e.user_id
      WHERE u.active=1${tenantId ? ` AND e.tenant_id=${Number(tenantId)}` : ""}
      ORDER BY u.name`
  );
}
