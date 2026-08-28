import Link from "next/link";
import { listTasks } from "@/lib/repo/tasks.js";
import { dashboardStats } from "@/lib/repo/stats.js";
import { Card, CardHeader, Table, EmptyRow, Badge, Stat } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, truncate } from "@/lib/utils";
import { TaskFilters } from "@/components/task-filters";

export const dynamic = "force-dynamic";

export default async function TasksPage({ searchParams }) {
  const sp = await searchParams;
  const status = sp?.status || "";
  const [tasks, stats] = await Promise.all([
    listTasks({ status: status || null, limit: 200 }),
    dashboardStats(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Today&apos;s AI tasks</h1>
        <p className="text-sm text-slate-500">Review the generated post, edit if needed, then approve and publish.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ready for review" value={stats.ready} tone="emerald" />
        <Stat label="Needs attention" value={stats.needs_review} tone="amber" />
        <Stat label="Rejected" value={stats.rejected} tone="red" />
        <Stat label="Published" value={stats.published} tone="indigo" />
      </div>

      <Card>
        <CardHeader title="Task queue" subtitle={`${tasks.length} tasks`} action={<TaskFilters current={status} />} />
        <Table
          head={["Client", "Topic", "Title", "Type", "AI score", "Status", "Updated", ""]}
          empty={!tasks.length ? <EmptyRow colSpan={8}>No tasks match this filter. Use &quot;Run AI job now&quot; to generate posts for today.</EmptyRow> : null}
        >
          {tasks.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="px-4 py-2">
                <p className="font-medium text-slate-800">{t.business_name}</p>
                <p className="text-xs text-slate-500">{t.city}</p>
              </td>
              <td className="px-4 py-2 text-slate-600">{truncate(t.topic, 30)}</td>
              <td className="px-4 py-2 text-slate-600">{truncate(t.title, 40)}</td>
              <td className="px-4 py-2"><Badge>{t.post_type}</Badge></td>
              <td className="px-4 py-2">
                {t.qa_score === null ? <span className="text-xs text-slate-400">-</span> :
                  <Badge tone={t.qa_score >= 80 ? "emerald" : "amber"}>{t.qa_score}/100</Badge>}
              </td>
              <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
              <td className="px-4 py-2 text-xs text-slate-500">{formatDate(t.updated_at, true)}</td>
              <td className="px-4 py-2 text-right">
                <Link href={`/gmb/tasks/${t.id}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Open</Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
