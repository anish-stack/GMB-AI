import { listCoupons, listPlans } from "@/lib/saas/billing.js";
import { CouponManager } from "@/components/admin/coupon-manager";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const [coupons, plans] = await Promise.all([listCoupons(), listPlans({ activeOnly: true })]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Coupons</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Discounts applied when a subscription or credit-pack invoice is raised.</p>
      </div>
      <CouponManager coupons={JSON.parse(JSON.stringify(coupons))} plans={JSON.parse(JSON.stringify(plans))} />
    </div>
  );
}
