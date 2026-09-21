import { NextResponse } from "next/server";
import { guard } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { assertFeature } from "@/lib/saas/entitlements.js";
import { update, one } from "@/lib/db";
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
      return NextResponse.json({ ok: true });
    }

    const provider = new GoogleGMBProvider();

    if (body.action === "select") {
      const { locations } = await provider.syncClient(clientId, { locationName: body.locationName });
      const match = locations.find((l) => l.location.name === body.locationName);
      if (!match) return NextResponse.json({ error: "That location is not available on the connected account" }, { status: 400 });
      await update("clients", clientId, {
        google_account_id: match.account,
        google_location_name: match.location.name,
      });
      return NextResponse.json({ ok: true, linked: match.location.title || match.location.name });
    }

    // default: refresh the location list and cache performance
    const { accounts, locations, chosen } = await provider.syncClient(clientId);
    const row = await one("SELECT google_location_name FROM clients WHERE id=?", [clientId]);
    if (!row?.google_location_name && chosen) {
      await update("clients", clientId, {
        google_account_id: chosen.account,
        google_location_name: chosen.location.name,
      });
    }

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
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
