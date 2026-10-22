/**
 * v11.3: admin master switch - pause / resume all auto-publishing.
 *   node --conditions=react-server scripts/test-v11-3.mjs   (app on :3258, seed data)
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
  const r = await fetch(B + p, { ...opt, headers: { cookie: ck, ...(opt.body ? { "content-type": "application/json" } : {}) } });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";
const local = (ms = 0) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(Date.now() + ms));
  const g = (t) => p.find((x) => x.type === t).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
};
const cron = async () => (await fetch(`${B}/api/cron/calendar-post`, { method: "POST", headers: { "x-scheduler-key": process.env.SESSION_SECRET } })).json();
const ins = (d, t, topic) => sql(`INSERT INTO content_calendar (tenant_id, client_id, scheduled_date, scheduled_time, post_type, topic, status) VALUES (1,1,'${d}','${t}','Service','${topic}','SCHEDULED'); SELECT LAST_INSERT_ID();`);

try {
  const admin = await login("superadmin@gmbai.cloud", "super123");
  const owner = await login("owner@hovermedia.in", "owner123");
  sql("DELETE FROM ai_tasks WHERE client_id=1; DELETE FROM content_calendar; DELETE FROM gmb_posts WHERE client_id=1");
  sql("UPDATE client_posting_plans SET status='ACTIVE', start_date=CURDATE()-INTERVAL 3 DAY, end_date=CURDATE()+INTERVAL 60 DAY, posts_per_week=500, total_posts=5000, posting_days=NULL WHERE client_id=1 AND status<>'REPLACED'");

  let r = await j("/api/admin/autopublish", {}, owner);
  ok("tenant owner cannot use the admin switch", r.status === 403 || r.status === 401, r.status);
  r = await j("/api/admin/autopublish", {}, admin);
  ok("admin reads switch (ON by default)", r.status === 200 && r.data.paused === false, JSON.stringify(r.data));

  r = await j("/api/admin/autopublish", { method: "POST", body: JSON.stringify({ paused: true }) }, admin);
  ok("admin turns auto-publish OFF", r.status === 200 && r.data.paused === true && r.data.pausedAt, JSON.stringify(r.data));

  const past = local(-10 * 60000);
  const during = ins(past.date, past.time, "Due while paused");
  const res = await cron();
  ok("paused: calendar publisher publishes nothing", res.paused === true && res.published === 0, JSON.stringify(res));
  ok("paused: due entry stays unpublished", sql(`select status from content_calendar where id=${during}`) !== "PUBLISHED" && sql(`select count(*) from gmb_posts gp join ai_tasks t on t.id=gp.task_id where t.calendar_id=${during}`) === "0");

  r = await j(`/api/clients/1/auto-publish`, {}, owner);
  ok("tenant sees 'paused by admin'", r.status === 200 && r.data.paused === true, JSON.stringify(r.data).slice(0, 120));

  r = await j("/api/admin/autopublish", { method: "POST", body: JSON.stringify({ paused: false }) }, admin);
  ok("admin turns auto-publish ON", r.status === 200 && r.data.paused === false && r.data.resumeFrom, JSON.stringify(r.data));
  const now = local(0);
  const fresh = ins(now.date, now.time, "Due after resume");
  const res2 = await cron();
  ok("resume: post missed during pause is NOT auto-published (no flood)", sql(`select status from content_calendar where id=${during}`) !== "PUBLISHED", sql(`select status from content_calendar where id=${during}`));
  ok("resume: post due after resume IS published", sql(`select status from content_calendar where id=${fresh}`) === "PUBLISHED", `${sql(`select status from content_calendar where id=${fresh}`)} ${JSON.stringify(res2)}`);
  ok("audit logged", Number(sql("select count(*) from audit_logs where action in ('AUTOPUBLISH_PAUSED','AUTOPUBLISH_RESUMED')")) >= 2);
} catch (e) {
  R.push(["FAIL", "crashed", e.message]);
}
for (const [s, n, i] of R) console.log(`${s.padEnd(4)}  ${n}${i ? `  [${i}]` : ""}`);
console.log(`\n${R.filter((x) => x[0] === "PASS").length}/${R.length} passed`);
process.exit(R.some((x) => x[0] === "FAIL") ? 1 : 0);
