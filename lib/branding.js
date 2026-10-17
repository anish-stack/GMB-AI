import { one } from "./db.js";
import { getSettings } from "./saas/settings.js";

/**
 * Product branding.
 *   Platform: Admin -> Web settings (platform_name, logo_url) - "HBS Suite" by default.
 *   White-label: an agency can show its own name + logo in its workspace, emails,
 *   PDF reports and client-facing pages (tenants.brand_name / brand_logo_url).
 */
export const PRODUCT_NAME = "HBS Suite";

export async function platformBrand() {
  const s = await getSettings();
  return { name: s.platform_name || PRODUCT_NAME, logo: s.logo_url || null, favicon: s.favicon_url || null };
}

export function brandFor(tenant, platform) {
  const name = String(tenant?.brand_name || "").trim();
  const logo = String(tenant?.brand_logo_url || "").trim();
  return {
    name: name || platform.name,
    logo: logo || (name ? null : platform.logo),
    whiteLabel: Boolean(name || logo),
    platformName: platform.name,
  };
}

export async function tenantBrand(tenantOrId) {
  const platform = await platformBrand();
  if (!tenantOrId) return { ...platform, whiteLabel: false, platformName: platform.name };
  const t = typeof tenantOrId === "object" ? tenantOrId : await one("SELECT brand_name, brand_logo_url FROM tenants WHERE id=?", [tenantOrId]).catch(() => null);
  return brandFor(t, platform);
}

/** Emails are written with %%BRAND%%; replaced with the tenant's (or platform's) name on queueing. */
export async function brandNameForEmail({ tenantId = null, email = null } = {}) {
  let tid = tenantId;
  if (!tid && email) tid = (await one("SELECT tenant_id FROM users WHERE email=? LIMIT 1", [String(email).toLowerCase()]).catch(() => null))?.tenant_id || null;
  return (await tenantBrand(tid)).name;
}
