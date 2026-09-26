import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { query, insert } from "../db.js";
import { heartbeats } from "./heartbeat.js";
import { getIntegration } from "../integrations/store.js";
import { runIntegrationTest } from "../integrations/tests.js";

/** Status values: HEALTHY | WARNING | FAILED | NOT_CONFIGURED */
const ok = (message, meta) => ({ status: "HEALTHY", message, meta });
const warn = (message, meta) => ({ status: "WARNING", message, meta });
const fail = (message, meta) => ({ status: "FAILED", message, meta });
const off = (message = "Not configured") => ({ status: "NOT_CONFIGURED", message });

async function timed(fn, ms = 12000) {
  const t = Date.now();
  const r = await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms))]);
  return { ...r, ms: Date.now() - t };
}

const ago = (d) => (d ? Math.round((Date.now() - new Date(d).getTime()) / 60000) : null);

async function heartbeatCheck(name, maxMin, label) {
  const hb = (await heartbeats()).find((h) => h.name === name);
  if (!hb) return warn(`${label} has never reported. Is it running?`);
  const m = ago(hb.last_ok_at);
  if (m === null) return fail(`${label} ran but never succeeded: ${hb.message || ""}`, { last_run_at: hb.last_run_at });
  if (m > maxMin) return fail(`${label} last succeeded ${m} min ago`, { last_ok_at: hb.last_ok_at, last_run_at: hb.last_run_at });
  return ok(`Last success ${m} min ago`, { last_ok_at: hb.last_ok_at, message: hb.message });
}

async function integrationCheck(id) {
  const i = await getIntegration(id);
  if (!i?.configured) return off();
  if (!i.enabled) return warn("Configured but disabled");
  try {
    return ok(await runIntegrationTest(id, i.values));
  } catch (e) {
    return fail(String(e.message).slice(0, 200));
  }
}

function redisPing(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const s = net.connect({ host: u.hostname, port: Number(u.port || 6379), timeout: 4000 });
    s.on("connect", () => s.write(u.password ? `AUTH ${decodeURIComponent(u.password)}\r\nPING\r\n` : "PING\r\n"));
    s.on("data", (d) => { s.end(); d.toString().includes("PONG") ? resolve() : reject(new Error(d.toString().trim().slice(0, 80))); });
    s.on("timeout", () => { s.destroy(); reject(new Error("timeout")); });
    s.on("error", reject);
  });
}

export const CHECKS = {
  database: async () => {
    const t = Date.now();
    await query("SELECT 1");
    const [v] = await query("SELECT VERSION() v");
    const ms = Date.now() - t;
    return ms > 500 ? warn(`Slow (${ms}ms)`, { version: v.v }) : ok(`Connected (${ms}ms)`, { version: v.v });
  },
  migrations: async () => {
    const need = ["notification_broadcasts", "fcm_tokens", "report_shares", "api_usage_daily", "support_tickets", "cms_pages", "client_posting_plans", "integration_settings", "system_heartbeats", "signup_intents", "review_inbox", "listing_health", "rank_scans"];
    const rows = await query(`SELECT table_name t FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN (${need.map(() => "?").join(",")})`, need);
    const have = new Set(rows.map((r) => r.t || r.TABLE_NAME));
    const missing = need.filter((n) => !have.has(n));
    return missing.length ? fail(`Missing tables: ${missing.join(", ")} - run db/upgrade-*.sql`) : ok("All tables present");
  },
  redis: async () => (process.env.REDIS_URL ? (await redisPing(process.env.REDIS_URL), ok("PONG")) : off("Not used (MySQL-backed queue & rate limits)")),
  scheduler: () => heartbeatCheck("scheduler", 5, "Scheduler"),
  nightly_job: () => heartbeatCheck("nightly_job", 26 * 60, "Nightly AI job"),
  mail_worker: () => heartbeatCheck("mail_worker", 10, "Mail worker"),
  review_sync: () => heartbeatCheck("review_sync", 70, "Review sync"),
  google_places: () => integrationCheck("google_places"),
  mail_queue: async () => {
    const [r] = await query("SELECT SUM(status='PENDING') pending, SUM(status='FAILED') failed, MIN(CASE WHEN status='PENDING' THEN created_at END) oldest FROM email_queue");
    const m = ago(r.oldest);
    const meta = { pending: Number(r.pending || 0), failed: Number(r.failed || 0), oldest_minutes: m };
    if (m !== null && m > 30) return fail(`Oldest pending email is ${m} min old`, meta);
    if (Number(r.failed) > 0) return warn(`${r.failed} failed email(s)`, meta);
    return ok(`${meta.pending} pending`, meta);
  },
  storage: async () => {
    const dir = process.env.IMAGE_STORAGE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "storage");
    await fs.mkdir(dir, { recursive: true });
    const f = path.join(/*turbopackIgnore: true*/ dir, `.health-${Date.now()}`);
    await fs.writeFile(f, "ok");
    await fs.unlink(f);
    const { storageInfo } = await import("../storage/index.js");
    const info = storageInfo();
    return ok(`Writable · chain: ${info.fallbackChain.join(" -> ")}`, info);
  },
  disk: async () => {
    const s = await fs.statfs(process.cwd());
    const total = s.blocks * s.bsize;
    const used = (s.blocks - s.bfree) * s.bsize;
    const avail = s.bavail * s.bsize;
    const pct = Math.round((used / (used + avail)) * 100);
    const meta = { total_gb: +(total / 1e9).toFixed(1), available_gb: +(avail / 1e9).toFixed(1), used_pct: pct };
    if (avail < 1e9 || pct > 95) return fail(`${pct}% used · ${meta.available_gb} GB available`, meta);
    if (avail < 5e9 || pct > 85) return warn(`${pct}% used · ${meta.available_gb} GB available`, meta);
    return ok(`${pct}% used · ${meta.available_gb} GB available`, meta);
  },
  process: async () => {
    const mem = process.memoryUsage();
    const meta = { rss_mb: Math.round(mem.rss / 1e6), heap_mb: Math.round(mem.heapUsed / 1e6), uptime_min: Math.round(process.uptime() / 60), load: os.loadavg().map((n) => +n.toFixed(2)), free_mem_mb: Math.round(os.freemem() / 1e6), node: process.version };
    return meta.rss_mb > 1500 ? warn(`High memory ${meta.rss_mb} MB`, meta) : ok(`RSS ${meta.rss_mb} MB · up ${meta.uptime_min} min`, meta);
  },
  backend_api: async () => ok("Responding"),
  frontend: async () => {
    const url = process.env.APP_URL;
    if (!url) return warn("APP_URL not set");
    const res = await fetch(`${url.replace(/\/$/, "")}/login`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    return res.ok ? ok(`${url} → HTTP ${res.status}`) : fail(`${url} → HTTP ${res.status}`);
  },
  firebase: () => integrationCheck("firebase"),
  google_apis: () => integrationCheck("google"),
  razorpay: () => integrationCheck("razorpay"),
  smtp: () => integrationCheck("smtp"),
  ai_gemini: () => integrationCheck("gemini"),
  ai_openai: () => integrationCheck("openai"),
  ai_huggingface: () => integrationCheck("huggingface"),
  ai_ollama: () => integrationCheck("ollama"),
};

export const LABELS = {
  database: "Database", migrations: "Database migrations", redis: "Redis", scheduler: "Cron / scheduler", nightly_job: "Nightly AI job",
  mail_worker: "Mail worker", review_sync: "Review sync", google_places: "Google Places (rank grid)", mail_queue: "Email queue", storage: "Storage", disk: "Disk usage", process: "Memory / process",
  backend_api: "Backend API", frontend: "Frontend", firebase: "Firebase (FCM)", google_apis: "Google APIs / GBP", razorpay: "Razorpay",
  smtp: "SMTP", ai_gemini: "AI - Gemini", ai_openai: "AI - OpenAI", ai_huggingface: "AI - Hugging Face", ai_ollama: "AI - Ollama",
};

export async function runHealthChecks({ only = null, save = true, runBy = "system" } = {}) {
  const started = Date.now();
  const names = only ? Object.keys(CHECKS).filter((n) => only.includes(n)) : Object.keys(CHECKS);
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        return { name, label: LABELS[name], ...(await timed(CHECKS[name])) };
      } catch (e) {
        return { name, label: LABELS[name], ...fail(String(e.message || e).slice(0, 240)) };
      }
    }),
  );
  const overall = results.some((r) => r.status === "FAILED") ? "FAILED" : results.some((r) => r.status === "WARNING") ? "WARNING" : "HEALTHY";
  const duration = Date.now() - started;
  if (save) {
    try {
      await insert("health_check_runs", { overall, results: JSON.stringify(results), duration_ms: duration, run_by: runBy });
      await query("DELETE FROM health_check_runs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
    } catch { /* table missing */ }
  }
  return { overall, results, duration_ms: duration, at: new Date().toISOString() };
}

export async function healthHistory(limit = 20) {
  try {
    return await query(`SELECT id, overall, duration_ms, run_by, created_at FROM health_check_runs ORDER BY id DESC LIMIT ${Number(limit)}`);
  } catch {
    return [];
  }
}
