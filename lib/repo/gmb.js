import { query, one, update, insert } from "../db.js";

/** Columns that really exist on gmb_profiles. */
const PROFILE_COLUMNS = [
  "location_name", "category", "address", "phone", "website",
  "map_url", "opening_hours", "rating", "review_count",
];

/** Profile fields mirrored onto the clients row (source for AI knowledge base). */
const CLIENT_MIRROR = {
  location_name: "business_name",
  category: "business_category",
  phone: "phone",
  website: "website",
  address: "address",
  description: "description",
};

function pick(payload, keys) {
  const out = {};
  for (const k of keys) if (payload[k] !== undefined) out[k] = payload[k];
  return out;
}

/**
 * Saves the local copy of a GMB profile.
 * - profile columns -> gmb_profiles
 * - services        -> gmb_services (one row per service)
 * - description etc -> clients (so the AI agents use the same facts)
 */
export async function updateGmbProfile(clientId, payload = {}) {
  const profile = await one("SELECT id FROM gmb_profiles WHERE client_id=? LIMIT 1", [clientId]);
  const patch = pick(payload, PROFILE_COLUMNS);

  if (!profile) {
    const owner = await one("SELECT tenant_id FROM clients WHERE id=?", [clientId]);
    await insert("gmb_profiles", {
      tenant_id: owner?.tenant_id || null,
      client_id: clientId,
      location_name: patch.location_name || "New location",
      connection_status: "MOCK_CONNECTED",
      provider: "mock",
      ...patch,
    });
  } else if (Object.keys(patch).length) {
    await update("gmb_profiles", profile.id, patch);
  }

  if (Array.isArray(payload.services)) {
    const names = [...new Set(payload.services.map((s) => String(s || "").trim()).filter(Boolean))].slice(0, 100);
    await query("DELETE FROM gmb_services WHERE client_id=?", [clientId]);
    for (const name of names) {
      await insert("gmb_services", { client_id: clientId, name: name.slice(0, 160) });
    }
  }

  const clientPatch = {};
  for (const [from, to] of Object.entries(CLIENT_MIRROR)) {
    if (payload[from] === undefined) continue;
    const v = typeof payload[from] === "string" ? payload[from].trim() : payload[from];
    if (from === "location_name" && !v) continue; // never blank the business name
    clientPatch[to] = v;
  }
  if (Object.keys(clientPatch).length) await update("clients", clientId, clientPatch);

  return { ok: true, patch };
}

export async function setGmbConnectionStatus(clientId, status) {
  await update("clients", clientId, { gmb_connection_status: status });
  const profile = await one("SELECT id FROM gmb_profiles WHERE client_id=? LIMIT 1", [clientId]);
  if (profile) await update("gmb_profiles", profile.id, { connection_status: status });
}

/** Removes the GMB connection (profile row) without touching the client record. */
export async function deleteGmbProfile(clientId) {
  await query("DELETE FROM gmb_profiles WHERE client_id=?", [clientId]);
  await update("clients", clientId, { gmb_connection_status: "DISCONNECTED", gmb_location_id: null });
}

/**
 * Marks a client as LIVE on Google for a chosen location and copies the
 * listing basics into gmb_profiles. Every connect / sync / select path calls
 * this, so the client never stays on "mock_loc_…" or provider=mock.
 */
export async function linkGoogleLocation(clientId, accountName, location) {
  const locId = String(location.name || "").split("/").pop();
  const addr = location.storefrontAddress;
  const address = addr ? [...(addr.addressLines || []), addr.locality, addr.administrativeArea, addr.postalCode].filter(Boolean).join(", ") : null;
  const clientPatch = {
    google_account_id: accountName,
    google_location_name: location.name,
    gmb_location_id: locId,
    gmb_connection_status: "GOOGLE_CONNECTED",
  };
  if (location.metadata?.placeId) clientPatch.place_id = location.metadata.placeId;
  if (location.latlng?.latitude != null) {
    clientPatch.latitude = location.latlng.latitude;
    clientPatch.longitude = location.latlng.longitude;
  }
  await update("clients", clientId, clientPatch);

  const profileData = {
    provider: "google",
    connection_status: "GOOGLE_CONNECTED",
    location_name: location.title || null,
    category: location.categories?.primaryCategory?.displayName || null,
    address,
    phone: location.phoneNumbers?.primaryPhone || null,
    website: location.websiteUri || null,
    map_url: location.metadata?.mapsUri || null,
  };
  for (const k of Object.keys(profileData)) if (profileData[k] === null) delete profileData[k];
  const profile = await one("SELECT id FROM gmb_profiles WHERE client_id=? LIMIT 1", [clientId]);
  if (profile) await update("gmb_profiles", profile.id, profileData);
  else {
    const owner = await one("SELECT tenant_id FROM clients WHERE id=?", [clientId]);
    await insert("gmb_profiles", { tenant_id: owner?.tenant_id || null, client_id: clientId, location_name: location.title || "Google location", ...profileData });
  }
  return { locationId: locId, title: location.title || location.name };
}

/** Back to demo mode after disconnect. */
export async function unlinkGoogle(clientId) {
  await query("UPDATE gmb_profiles SET provider='mock', connection_status='MOCK_CONNECTED' WHERE client_id=?", [clientId]);
  await update("clients", clientId, { gmb_location_id: null });
}
