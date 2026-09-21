import { query } from "@/lib/db";
import { requireTenantContext } from "@/lib/saas/context.js";
import { CalendarBoard } from "@/components/calendar-board";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const ctx = await requireTenantContext();
  const from = new Date().toISOString().slice(0, 10);
  const [entries, clients] = await Promise.all([
    query(
      `SELECT c.*, cl.business_name,
              (SELECT t.id FROM ai_tasks t WHERE t.calendar_id=c.id ORDER BY t.id DESC LIMIT 1) AS task_id
         FROM content_calendar c JOIN clients cl ON cl.id=c.client_id
        WHERE c.scheduled_date >= ? AND c.tenant_id=? ORDER BY c.scheduled_date, cl.business_name LIMIT 300`,
      [from, ctx.tenantId]
    ),
    query("SELECT id, business_name FROM clients WHERE active=1 AND tenant_id=? ORDER BY business_name", [ctx.tenantId]),
  ]);

  const grouped = new Map();
  for (const e of entries) {
    const key = String(e.scheduled_date).slice(0, 10);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(e);
  }

  const days = [...grouped.entries()].map(([date, list]) => ({
    date,
    label: formatDate(date),
    entries: list,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Content calendar</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Scheduled GMB posts from today onwards.</p>
      </div>
      <CalendarBoard days={days} clients={clients} />
    </div>
  );
}
