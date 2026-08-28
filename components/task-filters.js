"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { TASK_STATUS } from "@/lib/constants";

export function TaskFilters({ current }) {
  const router = useRouter();
  return (
    <Select
      value={current || ""}
      onChange={(e) => router.push(e.target.value ? `/gmb/tasks?status=${e.target.value}` : "/gmb/tasks")}
      className="w-52"
      aria-label="Filter by status"
    >
      <option value="">All statuses</option>
      {Object.keys(TASK_STATUS).map((s) => (
        <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
      ))}
    </Select>
  );
}
