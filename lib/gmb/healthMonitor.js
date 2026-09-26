import { query, one } from "../db.js";
import { providerFor } from "./provider.js";

const RANK = { OK: 0, UNKNOWN: 1, WARNING: 2, CRITICAL: 3 };

/**
 * Checks one listing and stores the result in listing_health.
 * Notifies the tenant (push) when the status gets worse.
 */
export async function checkListing(clientId, { reason = "scheduled" } = {}) {
  const c = await one(
    `SELECT c.id, c.tenant_id, c.business_name, c.place_id, p.provider, p.connection_status
       FROM clients c LEFT JOIN gmb_profiles p ON p.client_id=c.id WHERE c.id=?`,
    [clientId],
  );
  if (!c) throw Object.assign(new Error("Client not found"), { status: 404 });
  const issues = [];
  const add = (code, severity, message) => issues.push({ code, severity, message });
  let state = null;

  if (c.connection_status === "DISCONNECTED" || !c.connection_status) add("NOT_CONNECTED", "WARNING", "Listing is not connected to Google.");
  try {
    state = await (await providerFor(clientId)).getListingState(clientId);
  } catch (err) {
    const msg = String(err.message || err);
    if (/401|403|invalid_grant|PERMISSION|unauthori[sz]ed|refresh/i.test(msg)) add("ACCESS_LOST", "CRITICAL", "Google access lost - the owner removed access or the token expired. Reconnect the account.");
    else add("CHECK_FAILED", "WARNING", `Could not read the listing: ${msg.slice(0, 160)}`);
  }

  if (state) {
    if (state.suspended) add("SUSPENDED", "CRITICAL", "Google suspended this listing. File a reinstatement request.");
    if (state.disabled) add("DISABLED", "CRITICAL", "Google disabled this listing.");
    if (state.hasVoiceOfMerchant === false && !state.suspended && !state.disabled) add("NO_OWNER_CONTROL", "CRITICAL", "No owner control (Voice of Merchant lost) - edits are not published.");
    if (state.needsVerification) add("NEEDS_VERIFICATION", "WARNING", "Listing needs verification.");
    if (state.ownershipConflict) add("OWNERSHIP_CONFLICT", "CRITICAL", "Someone else claims ownership of this listing.");
    if (state.duplicate) add("DUPLICATE", "WARNING", "Google marked this listing as a duplicate.");
    if (state.openStatus && state.openStatus !== "OPEN") add("NOT_OPEN", "WARNING", `Listing shows as ${state.openStatus.replaceAll("_", " ").toLowerCase()}.`);
    if (state.pendingEdits) add("PENDING_EDITS", "INFO", "Edits are waiting for Google review.");
    if (state.placeId && !c.place_id) await query("UPDATE clients SET place_id=?, latitude=COALESCE(latitude,?), longitude=COALESCE(longitude,?) WHERE id=?", [state.placeId, state.latitude, state.longitude, clientId]);
  }

  const [{ unreplied, oldest }] = await query(
    "SELECT COUNT(*) unreplied, MIN(review_created_at) oldest FROM review_inbox WHERE client_id=? AND status='UNREPLIED'",
    [clientId],
  );
  if (Number(unreplied) >= 5) add("UNREPLIED_REVIEWS", "WARNING", `${unreplied} reviews have no reply.`);
  else if (oldest && Date.now() - new Date(oldest).getTime() > 7 * 86400000) add("OLD_UNREPLIED", "WARNING", "A review has been waiting more than 7 days for a reply.");
  const [{ last }] = await query("SELECT MAX(published_at) last FROM gmb_posts WHERE client_id=? AND status<>'DELETED'", [clientId]);
  if (!last || Date.now() - new Date(last).getTime() > 14 * 86400000) add("NO_RECENT_POSTS", "WARNING", "No post published in the last 14 days.");

  const status = issues.some((i) => i.severity === "CRITICAL") ? "CRITICAL" : issues.some((i) => i.severity === "WARNING") ? "WARNING" : "OK";
  const prev = await one("SELECT status FROM listing_health WHERE client_id=?", [clientId]);
  await query(
    `INSERT INTO listing_health (client_id, tenant_id, status, issues, verified, has_voice_of_merchant, duplicate, open_status, checked_at, status_changed_at)
     VALUES (?,?,?,?,?,?,?,?,NOW(),NOW())
     ON DUPLICATE KEY UPDATE status_changed_at=IF(status<>VALUES(status), NOW(), status_changed_at), status=VALUES(status), issues=VALUES(issues),
       verified=VALUES(verified), has_voice_of_merchant=VALUES(has_voice_of_merchant), duplicate=VALUES(duplicate), open_status=VALUES(open_status), checked_at=NOW()`,
    [clientId, c.tenant_id, status, JSON.stringify(issues), state ? (state.needsVerification ? 0 : 1) : null, state?.hasVoiceOfMerchant == null ? null : state.hasVoiceOfMerchant ? 1 : 0, state ? (state.duplicate ? 1 : 0) : null, state?.openStatus || null],
  );

  if (prev && RANK[status] > RANK[prev.status] && status !== "OK") {
    const worst = issues.find((i) => i.severity === status) || issues[0];
    const { sendNotification } = await import("../notifications/service.js");
    await sendNotification({
      tenantId: c.tenant_id,
      type: status === "CRITICAL" ? "ALERT" : "WARNING",
      title: `${status === "CRITICAL" ? "Critical" : "Warning"}: ${c.business_name}`,
      body: worst?.message || "Listing health changed.",
      link: "/listing-health",
      push: status === "CRITICAL",
    });
    const { audit } = await import("../saas/audit.js");
    await audit({ tenantId: c.tenant_id, session: { name: "monitor" } }, "LISTING_HEALTH_CHANGED", { entity: "client", entityId: clientId, meta: { from: prev.status, to: status, reason } });
  }
  return { client_id: clientId, status, issues };
}

export async function checkAllListings({ tenantId = null } = {}) {
  const rows = await query(`SELECT id FROM clients WHERE active=1 ${tenantId ? "AND tenant_id=?" : ""}`, tenantId ? [tenantId] : []);
  const summary = { OK: 0, WARNING: 0, CRITICAL: 0, failed: 0 };
  for (const r of rows) {
    try {
      summary[(await checkListing(r.id)).status] += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}

export async function listHealth(tenantId) {
  const rows = await query(
    `SELECT c.id client_id, c.business_name, c.city, h.status, h.issues, h.checked_at, h.status_changed_at, h.verified, h.has_voice_of_merchant, h.duplicate, h.open_status
       FROM clients c LEFT JOIN listing_health h ON h.client_id=c.id WHERE c.tenant_id=? AND c.active=1
      ORDER BY FIELD(COALESCE(h.status,'UNKNOWN'),'CRITICAL','WARNING','UNKNOWN','OK'), c.business_name`,
    [tenantId],
  );
  return rows.map((r) => ({ ...r, status: r.status || "UNKNOWN", issues: r.issues ? JSON.parse(r.issues) : [] }));
}
