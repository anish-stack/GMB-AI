import { Badge } from "@/components/ui";
import { STATUS_TONE } from "@/lib/constants";

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || "slate"}>{String(status).replaceAll("_", " ")}</Badge>;
}

export function MockBadge({ children = "Mock / Prototype" }) {
  return <Badge tone="amber">{children}</Badge>;
}
