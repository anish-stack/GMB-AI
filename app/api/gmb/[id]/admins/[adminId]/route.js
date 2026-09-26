import { gmbRoute, requireMethod } from "@/lib/gmb/routeHelpers";

export const dynamic = "force-dynamic";

export const DELETE = gmbRoute("gmb.connect", async ({ provider, clientId, params }) => {
  requireMethod(provider, "removeAdmin");
  return provider.removeAdmin(clientId, decodeURIComponent(params.adminId));
});
