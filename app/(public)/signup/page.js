import { redirect } from "next/navigation";
import { listPlans } from "@/lib/saas/billing.js";
import { getSettings } from "@/lib/saas/settings.js";
import { SignupForm } from "@/components/signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }) {
  const settings = await getSettings();
  if (Number(settings.allow_signup) !== 1) redirect("/login");

  const sp = await searchParams;
  const plans = await listPlans({ publicOnly: true });
  const selected = plans.find((p) => p.slug === sp?.plan)?.slug || settings.default_plan_slug || plans[0]?.slug;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Create your workspace</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        You get an owner account, your own client list and an AI credit wallet.
      </p>
      <SignupForm plans={JSON.parse(JSON.stringify(plans))} selected={selected} />
    </div>
  );
}
