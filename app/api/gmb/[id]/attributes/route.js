import { gmbRoute, readJson, requireMethod } from "@/lib/gmb/routeHelpers";

export const dynamic = "force-dynamic";

/** GET: every attribute Google allows for this category, with current values. */
export const GET = gmbRoute("gmb.view", async ({ provider, clientId }) => {
  requireMethod(provider, "getAttributes");
  return provider.getAttributes(clientId);
});

/** PATCH { attributes: [{ id, type, value }] } - send only changed ones. */
export const PATCH = gmbRoute("gmb.edit", async ({ provider, clientId, request }) => {
  requireMethod(provider, "updateAttributes");
  const body = await readJson(request);
  const list = Array.isArray(body.attributes) ? body.attributes.slice(0, 100) : [];
  return provider.updateAttributes(clientId, list);
});
