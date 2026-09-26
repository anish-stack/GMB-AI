import { redirect } from "next/navigation";
import { listPlans } from "@/lib/saas/billing.js";
import { getSettings } from "@/lib/saas/settings.js";
import { razorpayConfig } from "@/lib/payments/razorpay.js";
import { SignupWizard } from "@/components/signup/signup-wizard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create your workspace" };

export default async function SignupPage({ searchParams }) {
  const settings = await getSettings();
  if (Number(settings.allow_signup) !== 1) redirect("/login");

  const sp = await searchParams;
  const [plans, rp] = await Promise.all([listPlans({ publicOnly: true }), razorpayConfig()]);
  const selected = plans.find((p) => p.slug === sp?.plan)?.slug || settings.default_plan_slug || plans[0]?.slug;
  const cycle = sp?.cycle === "YEARLY" ? "YEARLY" : "MONTHLY";

  return (
    <SignupWizard
      plans={JSON.parse(JSON.stringify(plans))}
      selected={selected}
      initialCycle={cycle}
      taxPercent={Number(settings.tax_percent || 0)}
      onlinePayments={rp.enabled}
      platformName={settings.platform_name || "GMB AI Cloud"}
      supportEmail={settings.support_email || ""}
    />
  );
}
