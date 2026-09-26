import { gmbRoute, readJson, requireMethod } from "@/lib/gmb/routeHelpers";

export const dynamic = "force-dynamic";

export const PATCH = gmbRoute("gmb.edit", async ({ provider, clientId, request, params }) => {
  requireMethod(provider, "updateActionLink");
  const { type, uri, preferred } = await readJson(request);
  return { item: await provider.updateActionLink(clientId, decodeURIComponent(params.linkId), { type, uri, preferred }) };
});

export const DELETE = gmbRoute("gmb.edit", async ({ provider, clientId, params }) => {
  requireMethod(provider, "deleteActionLink");
  return provider.deleteActionLink(clientId, decodeURIComponent(params.linkId));
});
