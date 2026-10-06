import { route } from "@/lib/saas/routeKit.js";
import { autopayStatus, startAutopay, confirmAutopay, cancelAutopay } from "@/lib/payments/autopay.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export const GET = route({ permission: "billing.view" }, async ({ ctx }) => autopayStatus(ctx.tenantId));

/** POST { action: "start" } -> checkout data · { action: "confirm", razorpay_* } · { action: "cancel" } */
export const POST = route({ permission: "billing.manage" }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  if (b.action === "start") return startAutopay(ctx.tenantId, { actor: ctx.name });
  if (b.action === "confirm") {
    const r = await confirmAutopay(ctx.tenantId, b);
    await audit(ctx, "AUTOPAY_ENABLED", { meta: { subscription: b.razorpay_subscription_id } });
    return r;
  }
  if (b.action === "cancel") {
    const r = await cancelAutopay(ctx.tenantId, { actor: ctx.name });
    await audit(ctx, "AUTOPAY_CANCELLED", {});
    return r;
  }
  throw Object.assign(new Error("Unknown action"), { status: 400 });
});
