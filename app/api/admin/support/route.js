import { route } from "@/lib/saas/routeKit.js";
import { listTickets } from "@/lib/support/tickets.js";

export const dynamic = "force-dynamic";

export const GET = route({ superAdmin: true }, async ({ request }) => {
  const sp = new URL(request.url).searchParams;
  const page = Math.max(parseInt(sp.get("page"), 10) || 1, 1);
  return {
    page,
    ...(await listTickets({ status: sp.get("status"), priority: sp.get("priority"), category: sp.get("category"), tenantId: sp.get("tenant_id") ? Number(sp.get("tenant_id")) : null, q: (sp.get("q") || "").slice(0, 80), limit: 30, offset: (page - 1) * 30 })),
  };
});
