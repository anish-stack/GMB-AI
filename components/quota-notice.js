import { Card, CardBody } from "@/components/ui";
import Link from "next/link";

export function QuotaNotice({ used, limit, label, planName }) {
  const unlimited = Number(limit) < 0;
  const left = unlimited ? Infinity : Math.max(0, Number(limit) - Number(used));
  const full = left === 0;

  return (
    <Card className={full ? "border-rose-200 dark:border-rose-900" : ""}>
      <CardBody className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">
          {unlimited
            ? `Unlimited ${label} on the ${planName} plan.`
            : `${used} of ${limit} ${label} used on the ${planName} plan${full ? " - limit reached." : `, ${left} left.`}`}
        </span>
        {full ? (
          <Link href="/billing" className="rounded-xl bg-[#F53236] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#e81d22]">
            Upgrade plan
          </Link>
        ) : null}
      </CardBody>
    </Card>
  );
}
