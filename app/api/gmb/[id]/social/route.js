import { gmbRoute, readJson, requireMethod } from "@/lib/gmb/routeHelpers";

export const dynamic = "force-dynamic";

/** Social profiles (Instagram, Facebook...), chat links (WhatsApp, SMS) and booking links. */
export const GET = gmbRoute("gmb.view", async ({ provider, clientId }) => {
  requireMethod(provider, "getSocialLinks");
  return provider.getSocialLinks(clientId);
});

/** PUT { values: { url_instagram: "https://...", ... } } - empty string removes a link. */
export const PUT = gmbRoute("gmb.edit", async ({ provider, clientId, request }) => {
  requireMethod(provider, "updateSocialLinks");
  const { values } = await readJson(request);
  await provider.updateSocialLinks(clientId, values || {});
  return provider.getSocialLinks(clientId);
});
