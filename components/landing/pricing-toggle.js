"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { LIMIT_KEYS, LIMIT_LABEL, isUnlimited } from "@/lib/saas/constants.js";

export default function PricingToggle({ plans, allowSignup }) {
  const [yearly, setYearly] = useState(false);
  const hasYearly = plans.some((p) => Number(p.price_yearly) > 0);

  return (
    <div>
      {hasYearly ? (
        <div className="mx-auto mb-10 flex w-fit items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setYearly(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              !yearly ? "bg-[#F53236] text-white" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              yearly ? "bg-[#F53236] text-white" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
            }`}
          >
            Yearly
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                yearly ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"
              }`}
            >
              Save 20%
            </span>
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p, i) => {
          const popular = i === Math.min(1, plans.length - 1) && plans.length > 1;
          const showYearly = yearly && Number(p.price_yearly) > 0;
          const price = showYearly ? Math.round(Number(p.price_yearly) / 12) : Number(p.price_monthly);
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 dark:bg-zinc-900 ${
                popular
                  ? "border-[#F53236] shadow-[0_0_0_1px_#F53236]"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {popular ? (
                <span className="absolute -top-3 right-6 rounded-full bg-[#F53236] px-3 py-1 text-[11px] font-semibold text-white">
                  Most popular
                </span>
              ) : null}
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</p>
              <p className="mt-1 min-h-8 text-xs text-zinc-500 dark:text-zinc-400">{p.tagline}</p>
              <p className="mt-4 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
                ₹{price.toLocaleString("en-IN")}
                <span className="text-sm font-normal text-zinc-500">/month</span>
              </p>
              {showYearly ? (
                <p className="mt-1 text-xs text-zinc-500">billed ₹{Number(p.price_yearly).toLocaleString("en-IN")} yearly</p>
              ) : null}
              {p.trial_days ? <p className="mt-1 text-xs text-emerald-600">{p.trial_days}-day free trial</p> : null}

              <ul className="mt-5 flex-1 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                {LIMIT_KEYS.filter((k) => k !== "max_keywords_client" && k !== "max_scheduled_posts").map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>
                      {isUnlimited(p[k]) ? "Unlimited" : p[k]} {LIMIT_LABEL[k].toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={allowSignup ? `/signup?plan=${p.slug}` : "/pricing"}
                className={`mt-6 rounded-xl px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                  popular
                    ? "bg-[#F53236] text-white hover:bg-[#e81d22]"
                    : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {Number(p.price_monthly) === 0 ? "Start free" : "Choose plan"}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
