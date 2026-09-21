import Link from "next/link";
import { Card, CardBody, Badge } from "@/components/ui";
import { LIMIT_LABEL, isUnlimited } from "@/lib/saas/constants.js";

const SHOW = ["max_clients", "max_posts_month", "max_team_members"];

export function PlanSummary({ ent }) {
  const wallet = ent.wallet;
  const low = wallet.balance <= (wallet.low_balance_alert || 50);

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-4 py-4">
        <div className="min-w-40">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Current plan</p>
          <p className="mt-0.5 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {ent.plan?.name || "No plan"}
            <Badge tone={ent.status === "ACTIVE" ? "emerald" : ent.status === "TRIALING" ? "blue" : "amber"}>
              {ent.status}
            </Badge>
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {ent.daysLeft > 0 ? `${ent.daysLeft} days left in this cycle` : "Cycle has ended"}
          </p>
        </div>

        <div className="min-w-36">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">AI credits</p>
          <p className={`mt-0.5 text-base font-semibold ${low ? "text-rose-600" : "text-zinc-900 dark:text-zinc-100"}`}>
            {wallet.balance}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {wallet.plan_credits} plan + {wallet.purchased_credits} bought
          </p>
        </div>

        {SHOW.map((key) => {
          const limit = ent.limits[key];
          const used =
            key === "max_clients" ? ent.live.clients
              : key === "max_team_members" ? ent.live.team_members
              : ent.usage.posts_generated;
          const unlimited = isUnlimited(limit);
          const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
          return (
            <div key={key} className="min-w-40 flex-1">
              <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>{LIMIT_LABEL[key]}</span>
                <span>{unlimited ? `${used} / ∞` : `${used} / ${limit}`}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-1.5 rounded-full ${pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${unlimited ? 6 : pct}%` }}
                />
              </div>
            </div>
          );
        })}

        <Link href="/billing" className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
          Manage plan
        </Link>
      </CardBody>
    </Card>
  );
}
