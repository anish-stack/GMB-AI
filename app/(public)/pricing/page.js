import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { listPlans, listCreditPacks } from "@/lib/saas/billing.js";
import { getSettings } from "@/lib/saas/settings.js";
import { FEATURE_KEYS, FEATURE_LABEL, LIMIT_KEYS, LIMIT_LABEL, isUnlimited } from "@/lib/saas/constants.js";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [plans, packs, settings] = await Promise.all([
    listPlans({ publicOnly: true }),
    listCreditPacks(),
    getSettings(),
  ]);

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Pricing</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Every plan includes the full AI pipeline: research, keywords, topic, content, hashtags and QA. You only pick the volume.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <div key={p.id} className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</p>
            <p className="mt-1 min-h-8 text-xs text-zinc-500 dark:text-zinc-400">{p.tagline}</p>
            <p className="mt-4 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
              ₹{Number(p.price_monthly).toLocaleString("en-IN")}
              <span className="text-sm font-normal text-zinc-500">/month</span>
            </p>
            {Number(p.price_yearly) > 0 ? (
              <p className="mt-1 text-xs text-zinc-500">or ₹{Number(p.price_yearly).toLocaleString("en-IN")} billed yearly</p>
            ) : null}
            {p.trial_days ? <p className="mt-1 text-xs text-emerald-600">{p.trial_days}-day free trial</p> : null}

            <ul className="mt-5 flex-1 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              {LIMIT_KEYS.filter((k) => k !== "max_keywords_client" && k !== "max_scheduled_posts").map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span>{isUnlimited(p[k]) ? "Unlimited" : p[k]} {LIMIT_LABEL[k].toLowerCase()}</span>
                </li>
              ))}
              {FEATURE_KEYS.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  {p[f] ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Minus className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
                  <span className={p[f] ? "" : "text-zinc-400"}>{FEATURE_LABEL[f]}</span>
                </li>
              ))}
            </ul>

            {Number(settings.allow_signup) === 1 ? (
              <Link
                href={`/signup?plan=${p.slug}`}
                className="mt-6 rounded-xl bg-[#F53236] px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-[#e81d22]"
              >
                {Number(p.price_monthly) === 0 ? "Start free" : "Choose plan"}
              </Link>
            ) : (
              <a href={`mailto:${settings.support_email}`} className="mt-6 rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                Contact sales
              </a>
            )}
          </div>
        ))}
      </div>

      {packs.length ? (
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Need more AI credits?</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Top-up packs stack on top of your plan credits and never expire.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {packs.map((p) => (
              <div key={p.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</p>
                <p className="mt-1 text-sm text-zinc-500">{p.credits} credits</p>
                <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">₹{Number(p.price).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-center text-xs text-zinc-400">
        Credits are consumed per AI call. A complete post (research → keywords → topic → content → hashtags → image → QA) costs roughly 12 credits.
      </p>
    </div>
  );
}
