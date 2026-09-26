import { gmbRoute, readJson, requireMethod } from "@/lib/gmb/routeHelpers";

export const dynamic = "force-dynamic";

/** Booking / ordering / reservation buttons shown on the listing. */
export const GET = gmbRoute("gmb.view", async ({ provider, clientId }) => {
  requireMethod(provider, "getActionLinks");
  return provider.getActionLinks(clientId);
});

export const POST = gmbRoute("gmb.edit", async ({ provider, clientId, request }) => {
  requireMethod(provider, "createActionLink");
  const { type, uri, preferred } = await readJson(request);
  if (!type || !uri) {
    const e = new Error("Link type and URL are required.");
    e.status = 400;
    throw e;
  }
  return { item: await provider.createActionLink(clientId, { type, uri: String(uri).trim(), preferred }) };
});
