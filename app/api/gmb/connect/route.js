import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { buildAuthUrl, verifyInviteToken, isOAuthConfigured, createInviteToken } from "@/lib/gmb/googleAuth.js";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The link you send to a client:  /api/gmb/connect?t=<invite token>
 *
 * The client is NOT logged into your panel, so the signed invite token in the URL
 * is the authorisation. It carries the client id and an expiry.
 * Staff can also open /api/gmb/connect?client=12 while signed in.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  let clientId = null;
  const token = searchParams.get("t");
  if (token) clientId = verifyInviteToken(token);

  if (!clientId && searchParams.get("client")) {
    const session = await getSession();
    if (session) clientId = Number(searchParams.get("client"));
  }

  if (!clientId) {
    return NextResponse.json({ error: "This connect link is invalid or has expired. Ask the agency for a new one." }, { status: 400 });
  }
  if (!isOAuthConfigured()) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set in .env" }, { status: 500 });
  }

  const client = await one("SELECT id FROM clients WHERE id=?", [clientId]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // state is re-signed so the callback can trust which client this consent belongs to
  return NextResponse.redirect(buildAuthUrl(createInviteToken(clientId, 1)));
}
