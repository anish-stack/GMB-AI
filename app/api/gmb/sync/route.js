import { NextResponse } from "next/server";
import { guard } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { assertFeature } from "@/lib/saas/entitlements.js";
import { one } from "@/lib/db";
import { linkGoogleLocation, unlinkGoogle } from "@/lib/repo/gmb.js";
import { GoogleGMBProvider } from "@/lib/gmb/googleProvider.js";
import { connectLink, disconnectClient } from "@/lib/gmb/googleAuth.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Staff endpoint: list a connected client's locations, pick one, or disconnect. */
export async function POST(request) {
  const g = await guard(request, { permission: "gmb.connect" });
  if (g.error) return g.error;

  const body = await request.json();
  const clientId = Number(body.clientId);
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);
    if (g.ctx.ent) assertFeature(g.ctx.ent, "f_google_publish");
    if (body.action === "link") {
      return NextResponse.json({ ok: true, link: connectLink(clientId) });
    }

    if (body.action === "disconnect") {
      await disconnectClient(clientId);
      await unlinkGoogle(clientId);
      return NextResponse.json({ ok: true });
    }

    const provider = new GoogleGMBProvider();

    if (body.action === "select") {
      const { locations } = await provider.syncClient(clientId, { locationName: body.locationName });
      const match = locations.find((l) => l.location.name === body.locationName);
      if (!match) return NextResponse.json({ error: "That location is not available on the connected account" }, { status: 400 });
      const linked = await linkGoogleLocation(clientId, match.account, match.location);
      return NextResponse.json({ ok: true, linked: linked.title, location_id: linked.locationId });
    }

    // default: refresh the location list and cache performance
    const { accounts, locations, chosen } = await provider.syncClient(clientId);
    // keep the current location if it still exists, else take the first one;
    // always re-link so gmb_profiles/provider/location id are repaired on every sync
    const row = await one("SELECT google_location_name FROM clients WHERE id=?", [clientId]);
    const current = row?.google_location_name ? locations.find((l) => l.location.name === row.google_location_name) : null;
    const target = current || chosen;
    let linked = null;
    if (target) linked = await linkGoogleLocation(clientId, target.account, target.location);

    let cached = 0;
    try {
      cached = await provider.cachePerformance(clientId);
    } catch {
      cached = 0;
    }

    return NextResponse.json({
      ok: true,
      accounts: accounts.length,
      locations: locations.map((l) => ({
        account: l.account,
        name: l.location.name,
        title: l.location.title,
        address: (l.location.storefrontAddress?.addressLines || []).join(", "),
      })),
      performance_days_cached: cached,
      linked: linked ? { title: linked.title, location_id: linked.locationId } : null,
      warning: locations.length ? null : "No locations on this Google account - sign in with the account that manages the business profile.",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
