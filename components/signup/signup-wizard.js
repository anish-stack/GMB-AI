"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Bot, Check, CheckCircle2, Loader2, MessageSquareReply, ShieldCheck, Sparkles } from "lucide-react";
import { PlanStep, DetailsStep, VerifyStep, PaymentStep } from "./steps";
import { money, lim, quoteOf, post } from "./shared";
import { openRazorpay } from "@/lib/hooks/razorpay-checkout";

const FEATURES = [
  [Bot, "AI writes, checks & schedules GMB posts every night"],
  [MessageSquareReply, "One-click AI replies to Google reviews"],
  [BarChart3, "Beautiful PDF reports for every client"],
  [ShieldCheck, "Human review before anything goes live"],
];

function Stepper({ steps, current }) {
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Signup progress">
      {steps.map((s, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${done ? "bg-emerald-500 text-white" : on ? "bg-[#F53236] text-white" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"}`}>
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={`hidden text-xs font-semibold sm:inline ${on ? "text-zinc-900 dark:text-white" : "text-zinc-400"}`}>{s}</span>
            {i < steps.length - 1 ? <span className={`h-0.5 flex-1 rounded ${done ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"}`} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function SidePanel({ plan, cycle, quote, platformName }) {
  return (
    <aside className="relative hidden overflow-hidden rounded-3xl bg-zinc-950 p-8 text-white lg:flex lg:flex-col">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#F53236]/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-violet-600/30 blur-3xl" />
      <div className="relative flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F53236]"><Sparkles className="h-4 w-4" /></span>
        {platformName}
      </div>
      <h1 className="relative mt-10 text-3xl font-bold leading-tight">
        Grow every client on Google <span className="text-[#ff6b6e]">on autopilot.</span>
      </h1>
      <ul className="relative mt-8 space-y-4">
        {FEATURES.map(([Icon, text]) => (
          <li key={text} className="flex items-start gap-3 text-sm text-zinc-300">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10"><Icon className="h-4 w-4" /></span>
            <span className="pt-1.5">{text}</span>
          </li>
        ))}
      </ul>
      {plan ? (
        <div className="relative mt-auto rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Selected plan</p>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="text-lg font-semibold">{plan.name}</p>
            <p className="text-lg font-bold">{quote.subtotal ? money(quote.subtotal, quote.currency) : "Free"}<span className="text-xs font-normal text-zinc-400">{quote.subtotal ? `/${cycle === "YEARLY" ? "yr" : "mo"}` : ""}</span></p>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-zinc-300">
            <li>✓ {lim(plan.max_clients, "clients")}</li>
            <li>✓ {lim(plan.max_posts_month, "posts per month")}</li>
            <li>✓ {Number(plan.ai_credits_month).toLocaleString("en-IN")} AI credits every month</li>
            {(plan.highlights || []).slice(0, 3).map((h) => <li key={h}>✓ {h}</li>)}
            {quote.trialDays ? <li className="font-semibold text-emerald-300">✓ {quote.trialDays}-day free trial, no card needed</li> : null}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

export function SignupWizard({ plans, selected, initialCycle, taxPercent, onlinePayments, platformName, supportEmail }) {
  const router = useRouter();
  const [step, setStep] = useState("plan"); // plan | details | verify | payment | done
  const [planSlug, setPlanSlug] = useState(selected);
  const [cycle, setCycle] = useState(initialCycle);
  const [form, setForm] = useState({ company_name: "", name: "", email: "", phone: "", password: "", terms: false });
  const [intent, setIntent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const plan = plans.find((p) => p.slug === planSlug) || plans[0];
  const quote = useMemo(() => (plan ? quoteOf(plan, cycle, taxPercent, onlinePayments) : null), [plan, cycle, taxPercent, onlinePayments]);
  const steps = quote?.requiresPayment ? ["Plan", "Account", "Verify", "Payment"] : ["Plan", "Account", "Verify"];
  const index = { plan: 0, details: 1, verify: 2, payment: 3, done: steps.length }[step];

  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (!e.cancelled) setError(e.message);
      if (e.status === 410) { setIntent(null); setStep("details"); }
    } finally {
      setBusy(false);
    }
  }

  function finish(result) {
    setDone(result);
    setStep("done");
    setTimeout(() => { router.push(result.redirect || "/dashboard"); router.refresh(); }, 1600);
  }

  const start = () =>
    run(async () => {
      if (!form.terms) throw new Error("Please accept the terms to continue.");
      const res = await post("/api/auth/signup/start", { ...form, plan_slug: planSlug, billing_cycle: cycle });
      setIntent(res);
      setStep("verify");
    });

  const verify = (code) =>
    run(async () => {
      const res = await post("/api/auth/signup/verify", { token: intent.token, code });
      if (res.next === "payment") {
        setIntent((i) => ({ ...i, ...res }));
        setStep("payment");
      } else finish(res);
    });

  const resend = () => run(() => post("/api/auth/signup/resend", { token: intent.token }));

  const pay = () =>
    run(async () => {
      const order = await post("/api/auth/signup/order", { token: intent.token });
      setIntent((i) => ({ ...i, testMode: order.testMode }));
      const resp = await openRazorpay(order);
      const res = await post("/api/auth/signup/complete", { token: intent.token, ...resp });
      finish(res);
    });

  if (!plans.length) {
    return <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No plans are available yet. Please contact {supportEmail || "support"}.</p>;
  }

  const serverQuote = intent?.quote || quote;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_1.1fr]">
      <SidePanel plan={plan} cycle={cycle} quote={quote} platformName={platformName} />

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        {step !== "done" ? <Stepper steps={steps} current={index} /> : null}

        {step === "plan" ? (
          <PlanStep plans={plans} planSlug={planSlug} setPlanSlug={setPlanSlug} cycle={cycle} setCycle={setCycle} onNext={() => setStep("details")} />
        ) : null}

        {step === "details" ? (
          <DetailsStep form={form} setForm={setForm} busy={busy} error={error} onBack={() => { setError(""); setStep("plan"); }} onSubmit={start} />
        ) : null}

        {step === "verify" && intent ? (
          <VerifyStep maskedEmail={intent.maskedEmail} busy={busy} error={error} onVerify={verify} onResend={resend}
            onEditEmail={() => { setError(""); setIntent(null); setStep("details"); }} />
        ) : null}

        {step === "payment" && intent ? (
          <PaymentStep plan={plan} cycle={cycle} quote={serverQuote} testMode={intent.testMode} busy={busy} error={error} onPay={pay} />
        ) : null}

        {step === "done" ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40"><CheckCircle2 className="h-9 w-9" /></span>
            <h2 className="mt-5 text-xl font-bold text-zinc-900 dark:text-white">Your workspace is ready 🎉</h2>
            <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              {done?.trialDays ? `Your ${done.trialDays}-day free trial has started. ` : ""}
              {done?.payLater ? "Your first invoice is waiting in Billing. " : ""}
              Taking you to your dashboard…
            </p>
            <Loader2 className="mt-5 h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : null}

        {step !== "done" ? (
          <p className="mt-6 text-center text-xs text-zinc-500">
            Already have an account? <Link href="/login" className="font-semibold text-[#F53236]">Sign in</Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
