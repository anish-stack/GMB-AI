import { query, one, insert, update, parseJson } from "../db.js";

function scope(tenantId, alias = "c") {
  return tenantId ? { sql: ` AND ${alias}.tenant_id=?`, params: [tenantId] } : { sql: "", params: [] };
}

export async function listClients(tenantId = null) {
  const s = scope(tenantId);
  return query(
    `SELECT c.*, u.name AS employee_name, t.name AS tenant_name,
            (SELECT COUNT(*) FROM gmb_services s WHERE s.client_id=c.id) AS service_count,
            (SELECT COUNT(*) FROM keywords k WHERE k.client_id=c.id) AS keyword_count,
            (SELECT COUNT(*) FROM gmb_posts p WHERE p.client_id=c.id) AS post_count
       FROM clients c
       LEFT JOIN employees e ON e.id=c.assigned_employee_id
       LEFT JOIN users u ON u.id=e.user_id
       LEFT JOIN tenants t ON t.id=c.tenant_id
      WHERE 1=1${s.sql}
      ORDER BY c.business_name`,
    s.params
  );
}

export async function getClient(id, tenantId = null) {
  const client = await one(
    `SELECT * FROM clients WHERE id=?${tenantId ? " AND tenant_id=?" : ""}`,
    tenantId ? [id, tenantId] : [id]
  );
  if (!client) return null;
  const [services, locations, keywords, profile, posts, tasks] = await Promise.all([
    query("SELECT * FROM gmb_services WHERE client_id=? ORDER BY id", [id]),
    query("SELECT * FROM target_locations WHERE client_id=? ORDER BY id", [id]),
    query("SELECT * FROM keywords WHERE client_id=? ORDER BY relevance_score DESC, id", [id]),
    one("SELECT * FROM gmb_profiles WHERE client_id=? LIMIT 1", [id]),
    query("SELECT * FROM gmb_posts WHERE client_id=? ORDER BY id DESC LIMIT 20", [id]),
    query("SELECT * FROM ai_tasks WHERE client_id=? ORDER BY id DESC LIMIT 20", [id]),
  ]);
  return {
    ...client,
    approved_claims: parseJson(client.approved_claims, []),
    prohibited_claims: parseJson(client.prohibited_claims, []),
    services,
    locations,
    keywords,
    profile: profile ? { ...profile, opening_hours: parseJson(profile.opening_hours, {}) } : null,
    posts,
    tasks,
  };
}

/** Ownership check used by every mutating route. */
export async function assertClientInTenant(clientId, tenantId) {
  if (!tenantId) return true;
  const row = await one("SELECT id FROM clients WHERE id=? AND tenant_id=?", [clientId, tenantId]);
  if (!row) {
    const err = new Error("Client not found");
    err.status = 404;
    throw err;
  }
  return true;
}

export async function createClient(payload, tenantId) {
  if (!tenantId) throw new Error("tenantId is required to create a client");

  const clientId = await insert("clients", {
    tenant_id: tenantId,
    business_name: payload.business_name,
    business_category: payload.business_category,
    description: payload.description || null,
    phone: payload.phone || null,
    website: payload.website || null,
    address: payload.address || null,
    city: payload.city || null,
    state: payload.state || null,
    country: payload.country || "India",
    preferred_language: payload.preferred_language || "English",
    content_tone: payload.content_tone || "Professional",
    posting_frequency: payload.posting_frequency || "WEEKLY",
    gmb_location_id: payload.gmb_location_id || `mock_loc_${Date.now()}`,
    gmb_connection_status: "MOCK_CONNECTED",
    assigned_employee_id: payload.assigned_employee_id || null,
    approved_claims: payload.approved_claims || [],
    prohibited_claims: payload.prohibited_claims || [],
  });

  await insert("gmb_profiles", {
    tenant_id: tenantId,
    client_id: clientId,
    location_name: `${payload.business_name}${payload.city ? " - " + payload.city : ""}`,
    category: payload.business_category,
    address: [payload.address, payload.city, payload.state].filter(Boolean).join(", "),
    phone: payload.phone || null,
    website: payload.website || null,
    opening_hours: payload.opening_hours || { mon_sat: "10:00-19:00", sun: "Closed" },
    connection_status: "MOCK_CONNECTED",
    provider: "mock",
  });

  for (const s of splitList(payload.services)) {
    await insert("gmb_services", { client_id: clientId, name: s });
  }
  for (const l of splitList(payload.target_locations)) {
    await insert("target_locations", { client_id: clientId, name: l });
  }
  for (const k of splitList(payload.target_keywords)) {
    await insert("keywords", {
      tenant_id: tenantId,
      client_id: clientId,
      keyword: k.toLowerCase(),
      kw_type: "PRIMARY",
      source: "CLIENT",
      relevance_score: 90,
      priority: "HIGH",
      reason: "Provided by client/admin",
    });
  }
  return clientId;
}

export async function updateClient(id, payload, tenantId = null) {
  await assertClientInTenant(id, tenantId);
  const fields = [
    "business_name", "business_category", "description", "phone", "website", "address",
    "city", "state", "country", "preferred_language", "content_tone", "posting_frequency",
    "gmb_location_id", "assigned_employee_id",
  ];
  const patch = {};
  for (const f of fields) if (payload[f] !== undefined) patch[f] = payload[f];
  if (payload.approved_claims !== undefined) patch.approved_claims = splitList(payload.approved_claims);
  if (payload.prohibited_claims !== undefined) patch.prohibited_claims = splitList(payload.prohibited_claims);
  if (Object.keys(patch).length) await update("clients", id, patch);

  const client = await one("SELECT tenant_id FROM clients WHERE id=?", [id]);

  if (payload.services !== undefined) {
    await query("DELETE FROM gmb_services WHERE client_id=?", [id]);
    for (const s of splitList(payload.services)) await insert("gmb_services", { client_id: id, name: s });
  }
  if (payload.target_locations !== undefined) {
    await query("DELETE FROM target_locations WHERE client_id=?", [id]);
    for (const l of splitList(payload.target_locations)) await insert("target_locations", { client_id: id, name: l });
  }
  if (payload.target_keywords !== undefined) {
    for (const k of splitList(payload.target_keywords)) {
      const exists = await one("SELECT id FROM keywords WHERE client_id=? AND keyword=?", [id, k.toLowerCase()]);
      if (!exists) {
        await insert("keywords", {
          tenant_id: client.tenant_id, client_id: id, keyword: k.toLowerCase(), kw_type: "PRIMARY",
          source: "CLIENT", relevance_score: 90, priority: "HIGH", reason: "Provided by client/admin",
        });
      }
    }
  }
}

export async function setClientActive(id, active, tenantId = null) {
  await assertClientInTenant(id, tenantId);
  await update("clients", id, { active: active ? 1 : 0 });
  const status = active ? "MOCK_CONNECTED" : "DISCONNECTED";
  await update("clients", id, { gmb_connection_status: status });
  const profile = await one("SELECT id FROM gmb_profiles WHERE client_id=? LIMIT 1", [id]);
  if (profile) await update("gmb_profiles", profile.id, { connection_status: status });
}

export async function deleteClient(id, tenantId = null) {
  await assertClientInTenant(id, tenantId);
  await query("DELETE FROM clients WHERE id=?", [id]);
}

export function splitList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  return String(v)
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
