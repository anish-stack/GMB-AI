import { route } from "@/lib/saas/routeKit.js";
import { query } from "@/lib/db";
import { assertClientInTenant } from "@/lib/repo/clients.js";

export const dynamic = "force-dynamic";

/** Recent GMB posts (published / approved) to re-use on Facebook / Instagram. */
export const GET = route({ permission: "gmb.view" }, async ({ ctx, params }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  return { items: await query("SELECT id, title, LEFT(description,120) description FROM ai_tasks WHERE client_id=? AND tenant_id=? AND status IN ('PUBLISHED','APPROVED','READY_FOR_REVIEW') ORDER BY id DESC LIMIT 15", [id, ctx.tenantId]) };
});
