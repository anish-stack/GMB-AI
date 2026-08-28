import { query } from "@/lib/db";
import { CalendarBoard } from "@/components/calendar-board";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const from = new Date().toISOString().slice(0, 10);
  const [entries, clients] = await Promise.all([
    query(
      `SELECT c.*, cl.business_name,
              (SELECT t.id FROM ai_tasks t WHERE t.calendar_id=c.id ORDER BY t.id DESC LIMIT 1) AS task_id
         FROM content_calendar c JOIN clients cl ON cl.id=c.client_id
        WHERE c.scheduled_date >= ? ORDER BY c.scheduled_date, cl.business_name LIMIT 300`,
      [from]
    ),
    query("SELECT id, business_name FROM clients WHERE active=1 ORDER BY business_name"),
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
        <h1 className="text-lg font-semibold text-slate-900">Content calendar</h1>
        <p className="text-sm text-slate-500">Scheduled GMB posts from today onwards.</p>
      </div>
      <CalendarBoard days={days} clients={clients} />
    </div>
  );
}
