import { publicApi, notFound } from "@/lib/api/public.js";
import { one } from "@/lib/db";
import { planOut } from "@/lib/api/serializers.js";
import { planUsage } from "@/lib/posting/plan.js";

export const dynamic = "force-dynamic";

export const GET = publicApi({ scope: "clients:read", endpoint: "clients.plan" }, async ({ params, tenantId }) => {
  const c = await one("SELECT id FROM clients WHERE id=? AND tenant_id=?", [Number(params.id), tenantId]);
  if (!c) throw notFound("Client not found");
  return planOut(await planUsage(c.id));
});
