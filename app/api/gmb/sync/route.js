import { NextResponse, after } from "next/server";
import { guard } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { assertFeature } from "@/lib/saas/entitlements.js";
import { one, query } from "@/lib/db";
import { linkGoogleLocation, unlinkGoogle } from "@/lib/repo/gmb.js";
import { importFromGoogle } from "@/lib/gmb/importFromGoogle.js";
import { importSiblingListings } from "@/lib/gmb/bulkConnect.js";
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

    // Same Google login manages more listings -> turn them into their OWN clients
    // (no more switching this client's location to post for another listing).
    if (body.action === "siblings") {
      const cur = await one("SELECT google_location_name, tenant_id FROM clients WHERE id=?", [clientId]);
      const { locations } = await provider.syncClient(clientId);
      const taken = new Set((await query("SELECT google_location_name n FROM clients WHERE tenant_id=? AND google_location_name IS NOT NULL", [cur.tenant_id])).map((r) => r.n));
      return NextResponse.json({
        ok: true,
        items: locations
          .filter((l) => l.location.name !== cur.google_location_name)
          .map((l) => ({ name: l.location.name, title: l.location.title, address: [...(l.location.storefrontAddress?.addressLines || []), l.location.storefrontAddress?.locality].filter(Boolean).join(", "), imported: taken.has(l.location.name) })),
      });
    }
    if (body.action === "siblings_import") {
      const wanted = new Set(Array.isArray(body.names) ? body.names : []);
      if (!wanted.size) return NextResponse.json({ error: "Select at least one listing" }, { status: 400 });
      const { locations } = await provider.syncClient(clientId);
      const res = await importSiblingListings(clientId, locations.filter((l) => wanted.has(l.location.name)));
      after(async () => {
        for (const c of res.created) await importFromGoogle(c.client_id).catch((e) => console.error("[import]", c.client_id, e.message));
      });
      return NextResponse.json({ ok: true, ...res });
    }

    if (body.action === "select") {
      // Only allowed while no listing is linked yet. Changing the listing is the
      // client's decision: send a new connect link and they pick again.
      const cur = await one("SELECT google_location_name FROM clients WHERE id=?", [clientId]);
      if (cur?.google_location_name && cur.google_location_name !== body.locationName) {
        return NextResponse.json({ error: "This client is already linked to its own listing. To change it, send a new connect link - the client picks the listing again." }, { status: 409 });
      }
      const { locations } = await provider.syncClient(clientId, { locationName: body.locationName });
      const match = locations.find((l) => l.location.name === body.locationName);
      if (!match) return NextResponse.json({ error: "Location not found on this Google account" }, { status: 404 });
      const linked = await linkGoogleLocation(clientId, match.account, match.location);
      const imported = await importFromGoogle(clientId).catch((e) => ({ error: e.message }));
      return NextResponse.json({ ok: true, linked: linked.title, location_id: linked.locationId, imported });
    }

    // default: refresh the location list and cache performance
    const { accounts, locations, chosen } = await provider.syncClient(clientId);
    // ONLY the listing this client chose. Other listings on the same Google login
    // are never shown or linked here. Nothing chosen yet: auto-link if there is
    // exactly one, otherwise the staff picks once.
    const row = await one("SELECT google_location_name FROM clients WHERE id=?", [clientId]);
    const current = row?.google_location_name ? locations.find((l) => l.location.name === row.google_location_name) : null;
    if (row?.google_location_name && !current) {
      return NextResponse.json({ error: "The linked listing is no longer available on this Google account (access removed or listing deleted). Send a new connect link." }, { status: 409 });
    }
    const target = current || (locations.length === 1 ? chosen : null);
    const visible = current ? [current] : locations;
    let linked = null;
    if (target) linked = await linkGoogleLocation(clientId, target.account, target.location);
    const imported = linked ? await importFromGoogle(clientId).catch((e) => ({ error: e.message })) : null;

    let cached = 0;
    try {
      cached = await provider.cachePerformance(clientId);
    } catch {
      cached = 0;
    }

    return NextResponse.json({
      ok: true,
      accounts: accounts.length,
      locations: visible.map((l) => ({
        account: l.account,
        name: l.location.name,
        title: l.location.title,
        address: (l.location.storefrontAddress?.addressLines || []).join(", "),
      })),
      performance_days_cached: cached,
      linked: linked ? { title: linked.title, location_id: linked.locationId } : null,
      imported,
      warning: !locations.length
        ? "No locations on this Google account - sign in with the account that manages the business profile."
        : !target ? "Pick the listing for this client (only once)." : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
