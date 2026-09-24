import { notFound } from "next/navigation";
import { getTask } from "@/lib/repo/tasks.js";
import { one } from "@/lib/db";
import { TaskReview } from "@/components/task-review";
import { AdminPostToolbar } from "@/components/admin/admin-post-actions";

export const dynamic = "force-dynamic";

export default async function AdminGmbPostDetailPage({ params }) {
  const { id } = await params;
  const task = await getTask(Number(id));
  if (!task) notFound();
  const tenant = await one("SELECT name FROM tenants WHERE id=?", [task.tenant_id]);
  const plain = JSON.parse(JSON.stringify(task));

  return (
    <TaskReview
      task={plain}
      backHref="/admin/gmb-posts"
      backLabel="Back to GMB postings"
      toolbar={<AdminPostToolbar taskId={plain.id} status={plain.status} tenantName={tenant?.name} />}
    />
  );
}
