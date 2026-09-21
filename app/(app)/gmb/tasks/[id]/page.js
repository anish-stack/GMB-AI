import { notFound } from "next/navigation";
import { getTask } from "@/lib/repo/tasks.js";
import { TaskReview } from "@/components/task-review";
import { requireTenantContext } from "@/lib/saas/context.js";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }) {
  const ctx = await requireTenantContext();
  const { id } = await params;
  const task = await getTask(Number(id), ctx.tenantId);
  if (!task) notFound();
  return (
    <TaskReview
      task={JSON.parse(JSON.stringify(task))}
      perms={{
        edit: ctx.can("task.edit"),
        approve: ctx.can("task.approve"),
        publish: ctx.can("task.publish"),
        generate: ctx.can("task.generate"),
      }}
    />
  );
}
