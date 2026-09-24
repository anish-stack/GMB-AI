import { query } from "@/lib/db";
import { requireTenantContext } from "@/lib/saas/context.js";
import { CalendarBoard } from "@/components/calendar-board";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const ctx = await requireTenantContext();
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    .toISOString()
    .slice(0, 10);

  const [entries, clients] = await Promise.all([
    query(
      `SELECT c.*, cl.business_name,
              (SELECT t.id FROM ai_tasks t WHERE t.calendar_id=c.id ORDER BY t.id DESC LIMIT 1) AS task_id
         FROM content_calendar c JOIN clients cl ON cl.id=c.client_id
        WHERE c.scheduled_date BETWEEN ? AND ? AND c.tenant_id=? ORDER BY c.scheduled_date, cl.business_name LIMIT 1000`,
      [from, to, ctx.tenantId],
    ),
    query(
      "SELECT id, business_name FROM clients WHERE active=1 AND tenant_id=? ORDER BY business_name",
      [ctx.tenantId],
    ),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Content calendar
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Plan, schedule and manage your GMB posts with ease.
        </p>
      </div>
      <CalendarBoard entries={entries} clients={clients} />
    </div>
  );
}
