import { gmbRoute, readJson, requireMethod } from "@/lib/gmb/routeHelpers";

export const dynamic = "force-dynamic";

/** Who can manage this listing on Google (owner, managers, pending invites). */
export const GET = gmbRoute("gmb.view", async ({ provider, clientId }) => {
  requireMethod(provider, "getAdmins");
  return provider.getAdmins(clientId);
});

/** Invite a manager - e.g. the agency's own Google account, so 800+ client logins aren't needed. */
export const POST = gmbRoute("gmb.connect", async ({ provider, clientId, request }) => {
  requireMethod(provider, "inviteAdmin");
  const { email, role } = await readJson(request);
  return { item: await provider.inviteAdmin(clientId, { email, role: role || "MANAGER" }) };
});
