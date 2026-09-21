import { listTasks } from "@/lib/repo/tasks.js";
import { requireTenantContext } from "@/lib/saas/context.js";
import { dashboardStats } from "@/lib/repo/stats.js";
import { Card, CardHeader, Stat } from "@/components/ui";
import { TaskFilters } from "@/components/task-filters";
import { TaskQueueTable } from "@/components/task-queue-table";

export const dynamic = "force-dynamic";

export default async function TasksPage({ searchParams }) {
  const ctx = await requireTenantContext();
  const sp = await searchParams;
  const status = sp?.status || "";
  const [tasks, stats] = await Promise.all([
    listTasks({ status: status || null, limit: 200, tenantId: ctx.tenantId }),
    dashboardStats(ctx.tenantId),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Today&apos;s AI tasks</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Review the generated post, edit if needed, then approve and publish. Select multiple rows to approve or reject in bulk.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ready for review" value={stats.ready} tone="emerald" />
        <Stat label="Needs attention" value={stats.needs_review} tone="amber" />
        <Stat label="Rejected" value={stats.rejected} tone="red" />
        <Stat label="Published" value={stats.published} tone="indigo" />
      </div>

      <Card>
        <CardHeader title="Task queue" subtitle={`${tasks.length} tasks`} action={<TaskFilters current={status} />} />
        <TaskQueueTable tasks={tasks} bulkEnabled={ctx.features.f_bulk_actions} canPublish={ctx.can("task.publish")} />
      </Card>
    </div>
  );
}
