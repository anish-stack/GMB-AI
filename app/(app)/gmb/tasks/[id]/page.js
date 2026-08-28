import { notFound } from "next/navigation";
import { getTask } from "@/lib/repo/tasks.js";
import { TaskReview } from "@/components/task-review";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }) {
  const { id } = await params;
  const task = await getTask(Number(id));
  if (!task) notFound();
  return <TaskReview task={JSON.parse(JSON.stringify(task))} />;
}
