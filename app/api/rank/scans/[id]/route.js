import { route } from "@/lib/saas/routeKit.js";
import { getScan } from "@/lib/rank/grid.js";

export const dynamic = "force-dynamic";

export const GET = route(
  { permission: "gmb.view" },
  async ({ ctx, params }) => ({ scan: await getScan(params.id, ctx.tenantId) }),
);
