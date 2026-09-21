import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/** Shows a warning some days before plan renewal/expiry, or when AI credits are running low. */
const WARN_DAYS = 7;

export function ExpiryAlert({ ent }) {
  if (!ent?.subscription) return null;
  const daysLeft = ent.daysLeft;
  const wallet = ent.wallet;
  const lowCredits = wallet && wallet.balance <= (wallet.low_balance_alert || 50);
  const expiringSoon = !ent.expired && daysLeft > 0 && daysLeft <= WARN_DAYS;
  const alreadyExpired = ent.expired || ent.blocked;

  if (!expiringSoon && !alreadyExpired && !lowCredits) return null;

  const tone = alreadyExpired ? "rose" : "amber";
  const bg = tone === "rose" ? "bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-900" : "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-900";
  const text = tone === "rose" ? "text-rose-700 dark:text-rose-300" : "text-amber-800 dark:text-amber-300";

  const messages = [];
  if (alreadyExpired) {
    messages.push(`Your ${ent.plan?.name || "plan"} subscription has expired or is inactive. Renew now to avoid service interruption.`);
  } else if (expiringSoon) {
    messages.push(`Your ${ent.plan?.name || "plan"} plan renews in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Make sure billing is set up.`);
  }
  if (lowCredits) {
    messages.push(`AI credits are running low (${wallet.balance} left).`);
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${bg} ${text}`}>
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {messages.join(" ")}
      </span>
      <Link href="/billing" className="shrink-0 rounded-xl bg-[#F53236] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#e81d22]">
        Go to billing
      </Link>
    </div>
  );
}
