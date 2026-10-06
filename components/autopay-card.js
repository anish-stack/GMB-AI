"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CalendarClock, CreditCard, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Card, Button, Alert, Badge, Skeleton } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { openRazorpaySubscription } from "@/lib/hooks/razorpay-checkout";

const LABEL = { CREATED: ["Waiting for authorisation", "amber"], AUTHENTICATED: ["Authorised", "emerald"], ACTIVE: ["Active", "emerald"], PENDING: ["Charge pending", "amber"], HALTED: ["Halted - payment failed", "red"], CANCELLED: ["Cancelled", "slate"], COMPLETED: ["Completed", "slate"] };
const d = (v) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-");

/** Billing -> Razorpay Autopay: renews the plan automatically (UPI AutoPay / card / e-mandate). */
export function AutopayCard({ canManage }) {
  const router = useRouter();
  const { data, error, loading, mutate } = useApi("/api/billing/autopay");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  async function enable() {
    setBusy("start");
    setMsg(null);
    try {
      const s = await apiFetch("/api/billing/autopay", { body: { action: "start" } });
      const resp = await openRazorpaySubscription(s);
      mutate(await apiFetch("/api/billing/autopay", { body: { action: "confirm", ...resp } }));
      setMsg({ tone: "green", text: s.firstChargeOn === "today" ? "Autopay is on - the first charge was taken now." : `Autopay is on. First automatic charge on ${d(s.firstChargeOn)}.` });
      router.refresh();
    } catch (e) {
      setMsg({ tone: e.cancelled ? "amber" : "red", text: e.message });
      mutate(await apiFetch("/api/billing/autopay").catch(() => data));
    } finally {
      setBusy("");
    }
  }
  async function cancel() {
    if (!window.confirm("Turn off autopay? Your plan stays active until the end of the paid period; after that you'll pay invoices manually.")) return;
    setBusy("cancel");
    setMsg(null);
    try {
      mutate(await apiFetch("/api/billing/autopay", { body: { action: "cancel" } }));
      setMsg({ tone: "green", text: "Autopay cancelled. Access stays active until the current period ends." });
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy("");
    }
  }
  if (loading && !data) return <Skeleton className="h-32" />;
  if (error) return <Alert>{error}</Alert>;
  const on = ["AUTHENTICATED", "ACTIVE", "PENDING"].includes(data.status);
  const [label, tone] = LABEL[data.status] || ["Off", "slate"];
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${on ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-brand-50 text-brand-600 dark:bg-brand-950/30"}`}>{on ? <BadgeCheck className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}</span>
          <div>
            <p className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900 dark:text-white">Razorpay Autopay <Badge tone={tone}>{label}</Badge>{data.testMode ? <Badge tone="amber">Test mode</Badge> : null}</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              {on ? `Your ${data.plan} plan renews automatically - ₹${data.amount?.total} ${data.cycle === "YEARLY" ? "every year" : "every month"} (incl. GST).`
                : "Renew automatically with UPI AutoPay, card or bank e-mandate. No more manual invoices or missed renewals."}
            </p>
            {data.amount ? (
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> {on ? `Next charge: ${d(data.nextChargeAt || data.periodEnd)}` : `Current period ends: ${d(data.periodEnd)}`}</span>
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Secured by Razorpay · cancel any time</span>
              </div>
            ) : null}
          </div>
        </div>
        {canManage ? (
          on ? (
            <Button variant="dangerGhost" onClick={cancel} disabled={Boolean(busy)}>{busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Cancel autopay</Button>
          ) : (
            <Button onClick={enable} disabled={Boolean(busy) || !data.available}>{busy === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Enable autopay</Button>
          )
        ) : null}
      </div>
      {!data.available && !on ? <p className="border-t border-zinc-100 bg-zinc-50 px-5 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">{data.reason}</p> : null}
      {msg ? <div className="px-5 pb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}
    </Card>
  );
}
