/**
 * v11.1: calendar auto-post at the scheduled time (default 05:00) + connect permission UI.
 * Server on :3258 with seed data:  node --conditions=react-server scripts/test-v11-1.mjs
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
  const r = await fetch(B + p, { ...opt, headers: { cookie: ck, ...(opt.body ? { "content-type": "application/json" } : {}) }, redirect: "manual" });
  const ct = r.headers.get("content-type") || "";
  return { status: r.status, data: ct.includes("json") ? await r.json().catch(() => null) : await r.text() };
};
const TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";
const local = (ms = 0) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(Date.now() + ms));
  const g = (t) => p.find((x) => x.type === t).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
};

try {
  const owner = await login("owner@hovermedia.in", "owner123");
  // clean slate for client 1
  sql("DELETE FROM ai_tasks WHERE client_id=1; DELETE FROM content_calendar; DELETE FROM gmb_posts WHERE client_id=1");
  sql("UPDATE client_posting_plans SET status='ACTIVE', start_date=CURDATE()-INTERVAL 3 DAY, end_date=CURDATE()+INTERVAL 60 DAY, posts_per_week=21, total_posts=500, posting_days=NULL WHERE client_id=1 AND status<>'REPLACED'");
  sql("UPDATE clients SET auto_publish=0 WHERE id=1"); // per-client auto-publish OFF: calendar must still post

  const tomorrow = local(86400000).date;
  let r = await j("/api/calendar", { method: "POST", body: JSON.stringify({ client_id: 1, dates: [tomorrow], post_type: "Service" }) }, owner);
  ok("calendar entry without time defaults to 05:00", r.status === 200 && sql(`select scheduled_time from content_calendar where id=${r.data.id}`) === "05:00", r.data?.error || sql(`select scheduled_time from content_calendar where id=${r.data?.id}`));

  const past = local(-10 * 60000);
  const later = local(60 * 60000);
  const far = local(8 * 3600000);
  const ins = (d, t, topic) => sql(`INSERT INTO content_calendar (tenant_id, client_id, scheduled_date, scheduled_time, post_type, topic, status) VALUES (1,1,'${d}','${t}','Service','${topic}','SCHEDULED'); SELECT LAST_INSERT_ID();`);
  const due = ins(past.date, past.time, "Due now post");
  const soon = ins(later.date, later.time, "In one hour post");
  const farId = ins(far.date, far.time, "Far later post");
  const rej = ins(past.date, past.time, "Rejected post");
  sql(`INSERT INTO ai_tasks (tenant_id, client_id, calendar_id, status, post_type, topic, scheduled_date, scheduled_time, title, description) VALUES (1,1,${rej},'REJECTED','Service','Rejected post','${past.date}','${past.time}','x','y')`);

  // run it the way the scheduler does: through the app
  const runCalendarPublisher = async () => (await fetch(`${B}/api/cron/calendar-post`, { method: "POST", headers: { "x-scheduler-key": process.env.SESSION_SECRET } })).json();
  const res = await runCalendarPublisher();
  ok("publisher ran", !res.disabled && res.due >= 2, JSON.stringify(res));
  ok("due entry published (no approval, auto_publish off)", sql(`select status from content_calendar where id=${due}`) === "PUBLISHED" && sql(`select status from ai_tasks where calendar_id=${due}`) === "PUBLISHED", `${sql(`select status from content_calendar where id=${due}`)} / ${sql(`select status from ai_tasks where calendar_id=${due}`)}`);
  ok("post exists on GMB (mock)", Number(sql(`select count(*) from gmb_posts gp join ai_tasks t on t.id=gp.task_id where t.calendar_id=${due}`)) === 1);
  ok("rejected post never published", sql(`select status from content_calendar where id=${rej}`) === "SKIPPED" && sql(`select status from ai_tasks where calendar_id=${rej}`) === "REJECTED");
  ok("entry in 1 hour: written ahead, not published yet", sql(`select status from content_calendar where id=${soon}`) !== "PUBLISHED" && ["READY_FOR_REVIEW", "NEEDS_REVIEW"].includes(sql(`select status from ai_tasks where calendar_id=${soon}`)), sql(`select status from ai_tasks where calendar_id=${soon}`));
  ok("entry 8h away untouched", sql(`select count(*) from ai_tasks where calendar_id=${farId}`) === "0");
  const res2 = await runCalendarPublisher();
  ok("second run doesn't publish twice", Number(sql(`select count(*) from gmb_posts gp join ai_tasks t on t.id=gp.task_id where t.calendar_id=${due}`)) === 1, JSON.stringify(res2));

  // the 1-hour post becomes due
  sql(`UPDATE content_calendar SET scheduled_date='${past.date}', scheduled_time='${past.time}' WHERE id=${soon}`);
  sql(`UPDATE ai_tasks SET status='NEEDS_REVIEW', qa_score=40 WHERE calendar_id=${soon}`);
  await runCalendarPublisher();
  ok("low-QA (NEEDS_REVIEW) post still published at its time", sql(`select status from ai_tasks where calendar_id=${soon}`) === "PUBLISHED");

  // admin switch off
  sql("INSERT INTO platform_settings (skey, svalue) VALUES ('calendar_autopost','0') ON DUPLICATE KEY UPDATE svalue='0'");
  sql(`UPDATE content_calendar SET scheduled_date='${past.date}', scheduled_time='${past.time}' WHERE id=${farId}`);
  const off = await runCalendarPublisher();
  ok("admin switch OFF -> nothing published", off.disabled === true && sql(`select status from content_calendar where id=${farId}`) === "SCHEDULED", JSON.stringify(off));
  sql("UPDATE platform_settings SET svalue='1' WHERE skey='calendar_autopost'");

  r = await j("/api/clients/1/auto-publish", {}, owner);
  ok("automation card reports calendar auto-post", r.data?.calendar_autopost === true, JSON.stringify(r.data).slice(0, 120));

  /* connect permission UI */
  await j("/api/team/4", { method: "PATCH", body: JSON.stringify({ permissions: ["client.view", "gmb.view", "gmb.edit"] }) }, owner);
  const neha = await login("neha@hovermedia.in", "seo123");
  r = await j("/clients/1", {}, neha);
  ok("no connect permission: connect card hidden", r.status === 200 && !r.data.includes("connect link"), r.status);
  r = await j("/gmb", {}, neha);
  ok("no connect permission: import button hidden", r.status === 200 && !r.data.includes("Import all listings from Google"));
  r = await j("/gmb/1", {}, neha);
  ok("no connect permission: sync/remove hidden", r.status === 200 && !r.data.includes("Remove GMB connection"));
  r = await j("/api/gmb/1", { method: "DELETE" }, neha);
  ok("no connect permission: disconnect API 403", r.status === 403, r.status);
  r = await j("/api/gmb/sync", { method: "POST", body: JSON.stringify({ clientId: 1, action: "link" }) }, neha);
  ok("no connect permission: link API 403", r.status === 403, r.status);
  await j("/api/team/4", { method: "PATCH", body: JSON.stringify({ permissions: null }) }, owner);
  const neha2 = await login("neha@hovermedia.in", "seo123");
  r = await j("/clients/1", {}, neha2);
  ok("default member: connect card visible", r.status === 200 && r.data.toLowerCase().includes("connect link"));
} catch (e) {
  console.log("CRASH", e);
}
for (const q of R) console.log(q.join(" | "));
console.log(`\n${R.filter((q) => q[0] === "PASS").length}/${R.length} passed`);
process.exit(0);
