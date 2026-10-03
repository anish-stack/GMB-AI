import { NextResponse, after } from "next/server";
import { linkGoogleLocation } from "@/lib/repo/gmb.js";
import { importFromGoogle } from "@/lib/gmb/importFromGoogle.js";
import { verifyInviteToken, exchangeCode, fetchGoogleEmail, saveClientTokens, createInviteToken } from "@/lib/gmb/googleAuth.js";
import { GoogleGMBProvider } from "@/lib/gmb/googleProvider.js";
import { readState, saveConnection } from "@/lib/gmb/bulkConnect.js";
import { resultPage, pickerPage } from "@/lib/gmb/connectPages.js";

export const dynamic = "force-dynamic";

/**
 * Google sends the user back here after they press Allow.
 *
 * - Bulk state (agency "connect all"): store a tenant-level connection and open
 *   the import screen, where each selected listing becomes its own client.
 * - Client invite link: store the client's tokens. One listing -> linked
 *   automatically. Several -> the client picks exactly ONE (no more "all
 *   listings connected" + manual sync / change location).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const base = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (error) return resultPage(false, `Google returned: ${error}`);
  if (!code) return resultPage(false, "No authorisation code was returned by Google.");

  // ---- bulk / agency mode ----
  const bulk = readState(state);
  if (bulk?.k === "bulk") {
    try {
      const tokens = await exchangeCode(code);
      const email = await fetchGoogleEmail(tokens.access_token);
      const id = await saveConnection(bulk.t, tokens, email, bulk.u);
      return NextResponse.redirect(`${base}/gmb/import?connection=${id}`);
    } catch (err) {
      return resultPage(false, err.message);
    }
  }

  // ---- single client invite ----
  const clientId = verifyInviteToken(state);
  if (!clientId) return resultPage(false, "This connection link has expired. Ask the agency for a new one.");
  try {
    const tokens = await exchangeCode(code);
    const email = await fetchGoogleEmail(tokens.access_token);
    await saveClientTokens(clientId, tokens, email);

    const { locations } = await new GoogleGMBProvider().syncClient(clientId);
    if (!locations.length) {
      return resultPage(false, "No listings were found on this Google account. Please sign in with the Google account that manages the business profile.");
    }
    if (locations.length > 1) return pickerPage(createInviteToken(clientId, 1), locations, email);

    const only = locations[0];
    await linkGoogleLocation(clientId, only.account, only.location);
    after(() => importFromGoogle(clientId).catch((e) => console.error("[import]", e.message)));
    return resultPage(true, `Google Business Profile connected${email ? ` as ${email}` : ""}. Linked: ${only.location.title || only.location.name}.`);
  } catch (err) {
    return resultPage(false, err.message);
  }
}
