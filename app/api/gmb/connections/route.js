import { route } from "@/lib/saas/routeKit.js";
import { listConnections, deleteConnection } from "@/lib/gmb/bulkConnect.js";

export const dynamic = "force-dynamic";

export const GET = route({ permission: "gmb.view" }, async ({ ctx }) => ({ items: await listConnections(ctx.tenantId) }));

/** DELETE ?id= - forget a bulk connection (clients already created keep their own copy). */
export const DELETE = route({ permission: "gmb.connect" }, async ({ ctx, request }) => deleteConnection(new URL(request.url).searchParams.get("id"), ctx.tenantId));
