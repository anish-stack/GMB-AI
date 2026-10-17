/**
 * v11 checks: team permissions, admin prompts, image styles, white-label, own-company account.
 * Server on :3258 with the seed data:  node --conditions=react-server scripts/test-v11.mjs
 */
import "dotenv/config";
import { execSync } from "node:child_process";
const B = process.env.TEST_URL || "http://localhost:3258";
const R = [];
const ok = (n, c, i = "") => R.push([c ? "PASS" : "FAIL", n, String(i).slice(0, 160)]);
const sql = (q) => execSync(`mysql -u${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} -N -e "${q.replace(/"/g, '\\"')}"`).toString().trim();
const login = async (e, p) => {
  const r = await fetch(B + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: e, password: p }) });
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
};
const j = async (p, opt = {}, ck) => {
  const r = await fetch(B + p, { ...opt, headers: { cookie: ck, ...(opt.body && typeof opt.body === "string" ? { "content-type": "application/json" } : {}) }, redirect: "manual" });
  const ct = r.headers.get("content-type") || "";
  return { status: r.status, loc: r.headers.get("location"), data: ct.includes("json") ? await r.json().catch(() => null) : await r.text() };
};
const post = (p, b, ck, method = "POST") => j(p, { method, body: JSON.stringify(b) }, ck);

try {
  const owner = await login("owner@hovermedia.in", "owner123");
  const admin = await login("superadmin@gmbai.cloud", "super123");
  let neha = await login("neha@hovermedia.in", "seo123");

  /* ---------- permissions ---------- */
  let r = await j("/api/clients", {}, neha);
  ok("member default: clients allowed", r.status === 200, r.status);
  r = await j("/billing", {}, neha);
  ok("member default: billing page blocked", r.status === 307 && String(r.loc).includes("denied=billing.view"), r.loc);
  r = await j("/api/billing/autopay", {}, neha);
  ok("member default: billing API blocked", r.status === 403, r.status);
  r = await j("/dashboard", {}, neha);
  ok("member sidebar hides Billing/Settings items", r.status === 200 && !r.data.includes('href="/billing"') && r.data.includes('href="/clients"'));
  r = await post("/api/team/4", { permissions: ["client.view", "gmb.view"] }, owner, "PATCH");
  ok("owner sets custom permissions", r.status === 200, JSON.stringify(r.data));
  r = await j("/api/clients", {}, neha);
  ok("custom perms apply instantly (clients still ok)", r.status === 200);
  r = await j("/gmb/calendar", {}, neha);
  ok("custom perms: calendar now blocked", r.status === 307, r.loc);
  r = await post("/api/team/4", { permissions: ["client.view", "gmb.view", "billing.view"] }, owner, "PATCH");
  r = await j("/billing", {}, neha);
  ok("owner grants billing -> member sees billing", r.status === 200);
  const ravi = await login("ravi@hovermedia.in", "seo123");
  r = await post("/api/team/4", { permissions: [] }, ravi, "PATCH");
  ok("non-owner can't change permissions", r.status === 403, r.status);
  r = await post("/api/team", { name: "X", email: `x${Date.now()}@t.in`, password: "secret12", role: "OWNER" }, ravi);
  ok("non-owner can't create owner", r.status === 403, r.status);
  const email = `new${Date.now()}@t.in`;
  r = await post("/api/team", { name: "New", email, password: "secret12", role: "MEMBER", permissions: ["client.view", "task.view", "bogus.perm"] }, owner);
  ok("owner adds member with chosen permissions", r.status === 200 && sql(`select permissions from users where email='${email}'`) === '["client.view","task.view"]', sql(`select permissions from users where email='${email}'`));
  r = await post("/api/team/4", { permissions: null }, owner, "PATCH");
  ok("reset to default", sql("select permissions is null from users where id=4") === "1");
  r = await j("/team", {}, owner);
  ok("team page shows Permissions button", r.status === 200 && r.data.includes("Permissions"));

  /* ---------- prompts ---------- */
  r = await j("/api/admin/prompts", {}, admin);
  ok("admin lists prompts", r.status === 200 && r.data.items.length >= 20 && r.data.items.some((i) => i.key === "content.system"), r.data?.items?.length);
  r = await j("/api/admin/prompts", {}, owner);
  ok("tenant can't read prompts", r.status === 403 || r.status === 401, r.status);
  r = await post("/api/admin/prompts", { key: "content.extra", content: "Always mention free parking." }, admin, "PUT");
  ok("save extra instructions", r.status === 200 && sql("select content from ai_prompts where pkey='content.extra'") === "Always mention free parking.");
  r = await post("/api/admin/prompts", { key: "guide.gbp_rules", content: "CUSTOM GBP RULES FOR TEST" }, admin, "PUT");
  r = await post("/api/admin/prompts", { key: "content.system", content: "" }, admin, "PUT");
  ok("empty system prompt rejected", r.status === 400);
  const { applyPromptOverrides, clearPromptCache } = await import("../lib/ai/promptStore.js");
  const { GBP_RULES } = await import("../lib/ai/prompts/guide.js");
  clearPromptCache();
  const applied = await applyPromptOverrides("content", "SYS", `head\n${GBP_RULES}\ntail`);
  ok("runAI applies block + extra", applied.prompt.includes("CUSTOM GBP RULES FOR TEST") && !applied.prompt.includes(GBP_RULES) && applied.prompt.endsWith("Always mention free parking."), applied.prompt.slice(0, 80));
  r = await j("/api/admin/prompts?key=guide.gbp_rules", { method: "DELETE" }, admin);
  clearPromptCache();
  const back = await applyPromptOverrides("content", "SYS", `x\n${GBP_RULES}`);
  ok("reset to default", back.prompt.includes(GBP_RULES));
  r = await j("/admin/prompts", {}, admin);
  ok("admin prompts page", r.status === 200);

  /* ---------- image styles ---------- */
  r = await j("/api/admin/image-styles", {}, admin);
  ok("admin lists 3 seeded styles", r.status === 200 && r.data.items.length === 3 && r.data.items.find((s) => s.is_default).mode === "BRANDED_PHOTO");
  r = await post("/api/admin/image-styles", { name: "Test poster", mode: "AI_POSTER", overlay: "LOGO", aspect: "4:3", prompt: "Poster for {{business}} in {{city}}: \"{{headline}}\" {{point1}}" }, admin);
  const sid = r.data?.style?.id;
  ok("create style", r.status === 200 && sid, JSON.stringify(r.data).slice(0, 80));
  r = await j("/api/image-styles", {}, owner);
  ok("workspace sees active styles", r.status === 200 && r.data.items.length === 4);
  r = await post("/api/clients/1/image-style", { style_id: sid }, owner, "PUT");
  ok("client picks style", r.status === 200 && sql("select image_style_id from clients where id=1") === String(sid));
  const { resolveStyle, renderStyle, styleVars } = await import("../lib/images/styles.js");
  const { buildKnowledge } = await import("../lib/repo/knowledge.js");
  const st = await resolveStyle(1);
  const kb = await buildKnowledge(1);
  const rendered = renderStyle(st.prompt, styleVars(kb, { topic: "Root canal", title: "Painless root canal", cta: "Call now" }, "#0055aa"));
  ok("style resolved + placeholders filled", st.id === sid && rendered.includes(kb.business) && rendered.includes("Painless root canal") && !rendered.includes("{{"), rendered.slice(0, 120));
  r = await post(`/api/admin/image-styles/1/test`, { client_id: 1 }, admin);
  ok("branded style preview renders without AI key", r.status === 200 && String(r.data?.image).startsWith("data:image/png"), r.status + " " + (r.data?.error || ""));
  r = await post(`/api/admin/image-styles/${sid}/test`, { client_id: 1 }, admin);
  ok("poster preview without AI key -> clear error", r.status === 400 && /provider/i.test(r.data?.error), r.data?.error);
  r = await j(`/api/admin/image-styles/1`, { method: "DELETE" }, admin);
  ok("default style can't be deleted", r.status === 400);
  r = await j(`/api/admin/image-styles/${sid}`, { method: "DELETE" }, admin);
  ok("delete style -> client back to default", r.status === 200 && sql("select image_style_id is null from clients where id=1") === "1");
  r = await j("/gmb/1?tab=posts", {}, owner);
  ok("profile page renders", r.status === 200);

  /* ---------- branding ---------- */
  r = await j("/login", {}, "");
  ok("login shows HBS Suite", r.data.includes("HBS Suite") && !r.data.includes("GMB AI Cloud"));
  r = await post("/api/settings/brand", { brand_name: "XYZ Digital" }, owner, "PUT");
  ok("agency sets brand name", r.status === 200 && r.data.brand_name === "XYZ Digital");
  r = await j("/dashboard", {}, owner);
  ok("workspace shows agency brand, not HBS Suite", r.data.includes("XYZ Digital") && /<title>[^<]*XYZ Digital/.test(r.data), (r.data.match(/<title>[^<]*<\/title>/) || [""])[0]);
  r = await post("/api/settings/brand", { brand_name: "Hack" }, neha, "PUT");
  ok("member can't change brand", r.status === 403);
  const { queueEmail } = await import("../lib/mail/queue.js");
  const { welcomeEmail } = await import("../lib/mail/templates.js");
  const tpl = welcomeEmail({ ownerName: "A", companyName: "B", appUrl: null });
  const qid = await queueEmail({ to: "client@x.in", subject: tpl.subject, html: tpl.html, text: tpl.text, tenantId: 1 });
  ok("emails use agency brand", sql(`select subject from email_queue where id=${qid}`).includes("XYZ Digital"), sql(`select subject from email_queue where id=${qid}`));
  const qid2 = await queueEmail({ to: "someone@else.in", subject: tpl.subject, html: tpl.html, text: tpl.text });
  ok("platform emails use HBS Suite", sql(`select subject from email_queue where id=${qid2}`).includes("HBS Suite"));
  r = await j("/dashboard", {}, await login("owner@peakdigital.in", "owner123"));
  ok("other tenant still HBS Suite", r.data.includes("HBS Suite") && !r.data.includes("XYZ Digital"));
  await post("/api/settings/brand", { brand_name: "" }, owner, "PUT");

  /* ---------- own company ---------- */
  sql("UPDATE credit_wallets SET plan_credits=0, purchased_credits=0 WHERE tenant_id=2");
  sql("UPDATE plans p JOIN subscriptions s ON s.plan_id=p.id SET p.max_team_members=1 WHERE s.tenant_id=2");
  const t2 = await login("owner@peakdigital.in", "owner123");
  r = await post("/api/team", { name: "T", email: `t2${Date.now()}@t.in`, password: "secret12", role: "MEMBER" }, t2);
  ok("normal tenant hits team limit", r.status === 402 || r.status === 403 || r.status === 400, r.status + " " + r.data?.error);
  r = await post("/api/admin/tenants/2", { action: "account_type", internal: true }, admin, "PATCH");
  ok("admin makes tenant own company", r.status === 200 && sql("select account_type from tenants where id=2") === "INTERNAL", r.status);
  r = await post("/api/team", { name: "T", email: `t3${Date.now()}@t.in`, password: "secret12", role: "MEMBER" }, t2);
  ok("own company: no team limit", r.status === 200, r.data?.error);
  const { assertCredits, consumeCredits, getWallet } = await import("../lib/saas/credits.js");
  await assertCredits(2, 5000);
  const used = await consumeCredits(2, 50, { reason: "TEST" });
  const w = await getWallet(2);
  ok("own company: credits never run out", used === 50 && w.unlimited && Number(w.plan_credits) === 0 && Number(w.lifetime_used) >= 50);
  sql("UPDATE subscriptions SET status='EXPIRED', current_period_end=CURDATE()-INTERVAL 30 DAY WHERE tenant_id=2");
  const { resolveEntitlements } = await import("../lib/saas/entitlements.js");
  const ent = await resolveEntitlements(2);
  ok("own company: never blocked by billing, all features", !ent.blocked && ent.internal && Object.values(ent.features).every(Boolean) && ent.limits.max_clients === -1);
  r = await j("/billing", {}, t2);
  ok("billing page shows own-company card", r.data.includes("Own company account") && r.data.includes("Unlimited AI credits"));
  r = await j("/dashboard", {}, t2);
  ok("topbar shows Unlimited credits", r.data.includes("Unlimited"));
  const { runBillingCycle } = await import("../lib/saas/billing.js");
  await runBillingCycle();
  ok("billing cycle skips own company", sql("select status from subscriptions where tenant_id=2 order by id desc limit 1") === "EXPIRED");
  r = await j("/api/admin/tenants", {}, admin);
  ok("admin tenants page", (await j("/admin/tenants", {}, admin)).status === 200);
  const out = execSync(`node --conditions=react-server scripts/create-own-company.mjs --email=boss${Date.now()}@hoverbusinessservices.com --password=StrongPass1 --name=Boss`, { cwd: process.cwd() }).toString();
  ok("create-own-company script", /HOVER BUSINESS SERVICES LLP/.test(out) && sql("select count(*) from tenants where name='HOVER BUSINESS SERVICES LLP' and account_type='INTERNAL'") === "1", out.split("\n").filter((l) => l.includes("✓"))[0]);
} catch (e) {
  console.log("CRASH", e);
}
for (const q of R) console.log(q.join(" | "));
console.log(`\n${R.filter((q) => q[0] === "PASS").length}/${R.length} passed`);
process.exit(0);
