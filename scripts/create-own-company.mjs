/**
 * Creates (or upgrades) the platform owner's own company workspace:
 * unlimited credits, limits and team, never billed.
 *
 *   node --conditions=react-server scripts/create-own-company.mjs \
 *     --email=you@hoverbusinessservices.com --password='StrongPass#1' [--name="Your Name"] [--company="HOVER BUSINESS SERVICES LLP"]
 *
 * If the email already owns a workspace, that workspace is converted instead.
 */
import "dotenv/config";

const arg = (k, d = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const company = arg("company", "HOVER BUSINESS SERVICES LLP");
const email = String(arg("email", "") || "").trim().toLowerCase();
const password = arg("password", "");
const name = arg("name", "Admin");

if (!email) {
  console.error("Usage: --email=owner@example.com --password=Secret123 [--company=\"HOVER BUSINESS SERVICES LLP\"]");
  process.exit(1);
}

const { one, query } = await import("../lib/db.js");
const existing = await one("SELECT id, tenant_id, role FROM users WHERE email=?", [email]);
let tenantId = existing?.tenant_id || null;

if (existing && !tenantId) {
  console.error("That email belongs to the super admin - use a different email for the company workspace.");
  process.exit(1);
}
if (!tenantId) {
  if (!password || password.length < 8) {
    console.error("New account: --password must be at least 8 characters.");
    process.exit(1);
  }
  const plan = await one("SELECT id FROM plans WHERE is_active=1 ORDER BY price_monthly DESC, id DESC LIMIT 1");
  const { provisionTenant } = await import("../lib/saas/tenants.js");
  const r = await provisionTenant({ companyName: company, ownerName: name, email, password, planId: plan?.id || null, trialDays: 0, actor: "create-own-company" });
  tenantId = r.tenantId;
  await query("UPDATE users SET otp_verified_once=1 WHERE id=?", [r.userId]);
}

await query("UPDATE tenants SET account_type='INTERNAL', status='ACTIVE', social_enabled=1, name=? WHERE id=?", [company, tenantId]);
await query("UPDATE subscriptions SET status='ACTIVE', cancel_at_period_end=0, current_period_end=DATE_ADD(CURDATE(), INTERVAL 100 YEAR) WHERE tenant_id=?", [tenantId]);
console.log(`✓ "${company}" (tenant #${tenantId}) is an own-company account: unlimited credits, limits and team, never billed.`);
console.log(`  Sign in with ${email}.`);
process.exit(0);
