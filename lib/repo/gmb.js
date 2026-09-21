import { query, one, update } from "../db.js";

const EDITABLE = [
  "location_name", "category", "address", "phone", "website",
  "map_url", "opening_hours", "rating", "review_count",
];

export async function updateGmbProfile(clientId, payload) {
  const profile = await one("SELECT * FROM gmb_profiles WHERE client_id=? LIMIT 1", [clientId]);
  const patch = {};
  for (const k of EDITABLE) if (payload[k] !== undefined) patch[k] = payload[k];

  if (!profile) {
    // No profile row yet (client was created without one) - create it.
    const { insert } = await import("../db.js");
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

  // Keep the client's own contact fields and mirrored columns in sync.
  const clientPatch = {};
  if (payload.category !== undefined) clientPatch.business_category = payload.category;
  if (payload.phone !== undefined) clientPatch.phone = payload.phone;
  if (payload.website !== undefined) clientPatch.website = payload.website;
  if (payload.address !== undefined) clientPatch.address = payload.address;
  if (Object.keys(clientPatch).length) await update("clients", clientId, clientPatch);
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
