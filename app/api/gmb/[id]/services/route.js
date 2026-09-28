import { gmbRoute, readJson, requireMethod } from "@/lib/gmb/routeHelpers";
import { query, insert } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET -> { categories:[{id,name,primary,serviceTypes}], items:[{serviceTypeId?,name,category,description,price}] } */
export const GET = gmbRoute("gmb.view", async ({ provider, clientId }) => {
  requireMethod(provider, "getServiceItems");
  return provider.getServiceItems(clientId);
});

/** PUT { items } -> replaces the whole service list on Google (and our local copy). */
export const PUT = gmbRoute("gmb.edit", async ({ provider, clientId, request }) => {
  requireMethod(provider, "updateServiceItems");
  const { items } = await readJson(request);
  if (!Array.isArray(items)) throw Object.assign(new Error("items[] required"), { status: 400 });
  const clean = items.map((i) => ({
    serviceTypeId: i.serviceTypeId || null,
    name: String(i.name || "").trim(),
    category: i.category || null,
    description: String(i.description || "").trim().slice(0, 300),
    price: i.price === "" || i.price === null || i.price === undefined ? null : Math.max(0, Number(i.price) || 0),
  })).filter((i) => i.name || i.serviceTypeId);
  const res = await provider.updateServiceItems(clientId, clean);
  if (!provider.isMock) {
    // keep the AI knowledge base in sync with Google
    await query("DELETE FROM gmb_services WHERE client_id=?", [clientId]);
    for (const i of clean) await insert("gmb_services", { client_id: clientId, name: i.name.slice(0, 160), description: i.description || null, price: i.price });
  }
  return res;
});
