import { gmbRoute, requireMethod } from "@/lib/gmb/routeHelpers";

export const dynamic = "force-dynamic";

/** GET ?q=dent -> [{ id: "categories/gcid:dentist", name: "Dentist" }] */
export const GET = gmbRoute("gmb.view", async ({ provider, clientId, request }) => {
  requireMethod(provider, "searchCategories");
  const sp = new URL(request.url).searchParams;
  const items = await provider.searchCategories(clientId, sp.get("q") || "", sp.get("region") || "IN");
  return { items };
});
