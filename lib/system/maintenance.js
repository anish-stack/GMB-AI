import { getSettings } from "../saas/settings.js";
import { ROLES } from "../saas/constants.js";

const list = (v) => String(v || "").split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

export async function maintenanceState() {
  const s = await getSettings();
  return {
    enabled: Number(s.maintenance_enabled) === 1,
    title: s.maintenance_title,
    message: s.maintenance_message,
    eta: s.maintenance_eta,
    allowedIps: list(s.maintenance_allowed_ips),
    allowedEmails: list(s.maintenance_allowed_emails),
    platformName: s.platform_name,
    supportEmail: s.support_email,
  };
}

/**
 * Who may keep working during maintenance:
 * super admins (also while impersonating), allow-listed emails and IPs.
 */
export function bypassesMaintenance(state, { session = null, ip = null } = {}) {
  if (!state.enabled) return true;
  if (session?.role === ROLES.SUPER_ADMIN || session?.impersonatedBy) return true;
  if (session?.email && state.allowedEmails.includes(String(session.email).toLowerCase())) return true;
  if (ip && state.allowedIps.includes(String(ip).toLowerCase())) return true;
  return false;
}

export function maintenanceError(state) {
  const e = new Error(state.message || "The platform is under maintenance.");
  e.status = 503;
  e.code = "MAINTENANCE";
  e.meta = { title: state.title, eta: state.eta || null };
  return e;
}
