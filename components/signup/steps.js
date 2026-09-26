"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CreditCard, Eye, EyeOff, Landmark, Loader2, Lock, Mail, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { money, lim, priceOf, passwordScore } from "./shared";

const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-[#F53236] focus:ring-4 focus:ring-[#F53236]/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function PrimaryButton({ busy, children, ...props }) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#F53236] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#F53236]/25 transition hover:bg-[#e81d22] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function ErrorBox({ children }) {
  return children ? (
    <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
      {children}
    </p>
  ) : null;
}

export function BackLink({ onClick, children = "Back" }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
      <ArrowLeft className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

/* ================= 1. PLAN ================= */
export function PlanStep({ plans, planSlug, setPlanSlug, cycle, setCycle, onNext }) {
  const yearlySaving = (() => {
    const p = plans.find((x) => Number(x.price_monthly) > 0 && Number(x.price_yearly) > 0);
    if (!p) return 0;
    return Math.round((1 - Number(p.price_yearly) / (Number(p.price_monthly) * 12)) * 100);
  })();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Choose your plan</h2>
        <div className="inline-flex rounded-xl bg-zinc-100 p-1 text-xs font-semibold dark:bg-zinc-800" role="radiogroup" aria-label="Billing cycle">
          {["MONTHLY", "YEARLY"].map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)}
              className={`rounded-lg px-3 py-1.5 transition ${cycle === c ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white" : "text-zinc-500"}`}>
              {c === "MONTHLY" ? "Monthly" : "Yearly"}
              {c === "YEARLY" && yearlySaving > 0 ? <span className="ml-1 text-emerald-600">-{yearlySaving}%</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3" role="radiogroup" aria-label="Plan">
        {plans.map((p) => {
          const on = p.slug === planSlug;
          const price = priceOf(p, cycle);
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setPlanSlug(p.slug)}
              className={`group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition ${on ? "border-[#F53236] bg-red-50/50 ring-4 ring-[#F53236]/10 dark:bg-red-950/10" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"}`}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-[#F53236] bg-[#F53236]" : "border-zinc-300 dark:border-zinc-600"}`}>
                {on ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold text-zinc-900 dark:text-white">
                    {p.name}
                    {Number(p.trial_days) > 0 && price > 0 ? (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{p.trial_days}-day free trial</span>
                    ) : null}
                  </p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-white">
                    {price ? money(price, p.currency) : "Free"}
                    {price ? <span className="text-xs font-medium text-zinc-400">/{cycle === "YEARLY" ? "yr" : "mo"}</span> : null}
                  </p>
                </div>
                {p.tagline ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{p.tagline}</p> : null}
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                  {lim(p.max_clients, "clients")} · {lim(p.max_posts_month, "posts/mo")} · {Number(p.ai_credits_month).toLocaleString("en-IN")} AI credits
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <PrimaryButton type="button" onClick={onNext}>Continue</PrimaryButton>
    </div>
  );
}

/* ================= 2. DETAILS ================= */
export function DetailsStep({ form, setForm, busy, error, onBack, onSubmit }) {
  const [show, setShow] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const score = passwordScore(form.password);
  const bars = ["bg-rose-500", "bg-amber-500", "bg-yellow-400", "bg-emerald-500"];
  const labels = ["Too weak", "Weak", "Okay", "Good", "Strong"];

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4" noValidate={false}>
      <BackLink onClick={onBack}>Change plan</BackLink>
      <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Create your account</h2>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Agency / company name</span>
        <input className={input} value={form.company_name} onChange={set("company_name")} required maxLength={180} autoComplete="organization" placeholder="Hover Media" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Your name</span>
          <input className={input} value={form.name} onChange={set("name")} required maxLength={120} autoComplete="name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Mobile</span>
          <input className={input} value={form.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98xxxxxxxx" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Work email</span>
        <input className={input} value={form.email} onChange={set("email")} type="email" required autoComplete="email" placeholder="you@company.com" />
        <span className="mt-1 block text-[11px] text-zinc-400">We&apos;ll send a 6-digit code to verify it.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Password</span>
        <div className="relative">
          <input className={`${input} pr-11`} value={form.password} onChange={set("password")} type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" placeholder="8+ characters, letters & numbers" />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {form.password ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex flex-1 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < score ? bars[score - 1] : "bg-zinc-200 dark:bg-zinc-700"}`} />)}</div>
            <span className="text-[11px] text-zinc-500">{labels[score]}</span>
          </div>
        ) : null}
      </label>
      <label className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <input type="checkbox" checked={form.terms} onChange={set("terms")} required className="mt-0.5 h-4 w-4 accent-[#F53236]" />
        <span>I agree to the Terms of Service and Privacy Policy.</span>
      </label>
      <ErrorBox>{error}</ErrorBox>
      <PrimaryButton type="submit" busy={busy}><Mail className="h-4 w-4" /> Send verification code</PrimaryButton>
    </form>
  );
}

/* ================= 3. VERIFY EMAIL ================= */
export function VerifyStep({ maskedEmail, busy, error, onVerify, onResend, onEditEmail }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(45);
  const refs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function fill(next) {
    setDigits(next);
    const code = next.join("");
    if (code.length === 6 && !busy) onVerify(code);
  }
  function onChange(i, v) {
    const only = v.replace(/\D/g, "");
    if (only.length > 1) {
      const next = [...digits];
      only.slice(0, 6 - i).split("").forEach((d, k) => { next[i + k] = d; });
      refs.current[Math.min(5, i + only.length)]?.focus();
      return fill(next);
    }
    const next = [...digits];
    next[i] = only;
    if (only && i < 5) refs.current[i + 1]?.focus();
    fill(next);
  }
  function onKeyDown(i, e) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  }

  return (
    <div className="space-y-5">
      <BackLink onClick={onEditEmail}>Wrong email? Edit</BackLink>
      <div>
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-[#F53236] dark:bg-red-950/30"><Mail className="h-6 w-6" /></span>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Check your inbox</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Enter the 6-digit code sent to <span className="font-semibold text-zinc-800 dark:text-zinc-200">{maskedEmail}</span>. Check spam if you don&apos;t see it.
        </p>
      </div>
      <div className="flex justify-between gap-2" onPaste={(e) => { e.preventDefault(); onChange(0, e.clipboardData.getData("text")); }}>
        {digits.map((d, i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }} value={d} onChange={(e) => onChange(i, e.target.value)} onKeyDown={(e) => onKeyDown(i, e)}
            inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={6} aria-label={`Digit ${i + 1}`} autoFocus={i === 0}
            className="h-14 w-full min-w-0 rounded-xl border border-zinc-300 bg-white text-center text-xl font-bold text-zinc-900 outline-none focus:border-[#F53236] focus:ring-4 focus:ring-[#F53236]/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
        ))}
      </div>
      <ErrorBox>{error}</ErrorBox>
      <PrimaryButton type="button" busy={busy} disabled={digits.join("").length !== 6} onClick={() => onVerify(digits.join(""))}>
        Verify email
      </PrimaryButton>
      <p className="text-center text-xs text-zinc-500">
        Didn&apos;t get it?{" "}
        {cooldown > 0 ? (
          <span>Resend in {cooldown}s</span>
        ) : (
          <button type="button" className="font-semibold text-[#F53236] hover:underline" onClick={async () => { setDigits(["", "", "", "", "", ""]); setCooldown(45); await onResend(); refs.current[0]?.focus(); }}>
            Resend code
          </button>
        )}
      </p>
    </div>
  );
}

/* ================= 4. PAYMENT ================= */
export function PaymentStep({ plan, cycle, quote, testMode, busy, error, onPay }) {
  const rows = [
    [`${plan.name} plan · ${cycle === "YEARLY" ? "yearly" : "monthly"}`, money(quote.subtotal, quote.currency)],
    [`GST (${quote.taxPercent}%)`, money(quote.tax, quote.currency)],
  ];
  return (
    <div className="space-y-5">
      <div>
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"><ShieldCheck className="h-6 w-6" /></span>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Email verified - complete payment</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Your workspace is created the moment payment succeeds.</p>
      </div>
      {testMode ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          Test mode - use Razorpay test cards/UPI. No real money is charged.
        </p>
      ) : null}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
            <span>{k}</span><span>{v}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-zinc-200 px-4 py-3 text-base font-bold text-zinc-900 dark:border-zinc-800 dark:text-white">
          <span>Total</span><span>{money(quote.total, quote.currency)}</span>
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <PrimaryButton type="button" busy={busy} onClick={onPay}>
        <Lock className="h-4 w-4" /> Pay {money(quote.total, quote.currency)} securely
      </PrimaryButton>
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-500">
        {[[Smartphone, "UPI"], [CreditCard, "Cards"], [Landmark, "Net banking"], [Wallet, "Wallets"]].map(([Icon, l]) => (
          <span key={l} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800"><Icon className="h-3 w-3" /> {l}</span>
        ))}
      </div>
      <p className="text-center text-[11px] text-zinc-400">Payments processed by Razorpay · PCI-DSS compliant · GST invoice emailed after payment</p>
    </div>
  );
}
