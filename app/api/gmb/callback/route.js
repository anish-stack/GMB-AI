import { NextResponse } from "next/server";
import { linkGoogleLocation } from "@/lib/repo/gmb.js";
import {
  verifyInviteToken, exchangeCode, fetchGoogleEmail, saveClientTokens,
} from "@/lib/gmb/googleAuth.js";
import { GoogleGMBProvider } from "@/lib/gmb/googleProvider.js";

export const dynamic = "force-dynamic";

/**
 * Google sends the client back here after they press Allow.
 * We exchange the code for THEIR refresh token, store it on their client row,
 * then immediately list their accounts and locations.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const clientId = verifyInviteToken(searchParams.get("state"));

  if (error) return page(false, `Google returned: ${error}`);
  if (!clientId) return page(false, "This connection link has expired. Ask the agency for a new one.");
  if (!code) return page(false, "No authorisation code was returned by Google.");

  try {
    const tokens = await exchangeCode(code);
    const email = await fetchGoogleEmail(tokens.access_token);
    await saveClientTokens(clientId, tokens, email);

    // pull their locations straight away so staff see something immediately
    let locationLine = "";
    try {
      const provider = new GoogleGMBProvider();
      const { locations, chosen } = await provider.syncClient(clientId);
      if (chosen) {
        await linkGoogleLocation(clientId, chosen.account, chosen.location);
        locationLine = `${locations.length} location(s) found. Linked: ${chosen.location.title || chosen.location.name}.`;
      } else {
        locationLine = "No locations were found on this Google account. Please sign in with the account that manages the business.";
      }
    } catch (syncErr) {
      locationLine = `Connected, but locations could not be listed yet: ${syncErr.message}`;
    }

    return page(true, `Google Business Profile connected${email ? ` as ${email}` : ""}. ${locationLine}`);
  } catch (err) {
    return page(false, err.message);
  }
}

function page(ok, message) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Google Business Profile</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
 body{font-family:system-ui,Segoe UI,Arial;background:#f1f5f9;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
 .card{background:#fff;max-width:460px;padding:28px;border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,.12);text-align:center}
 h1{font-size:18px;margin:0 0 8px;color:${ok ? "#047857" : "#b91c1c"}}
 p{font-size:14px;color:#475569;line-height:1.6;margin:0}
</style></head><body><div class="card">
 <h1>${ok ? "Connected successfully" : "Connection failed"}</h1>
 <p>${escapeHtml(message)}</p>
 <p style="margin-top:14px;font-size:12px;color:#94a3b8">You can close this window. Nothing is posted without your agency's review.</p>
</div></body></html>`;
  return new NextResponse(html, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}
