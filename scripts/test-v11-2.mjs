/**
 * v11.2: Ollama for text (Gemini fallback), Gemini-only images, one image per post,
 * "Regenerate" keeps the image.
 *
 *   node --conditions=react-server scripts/test-v11-2.mjs
 *
 * Part A needs nothing (fake Ollama started here). Part B needs the app on TEST_URL
 * (default :3258) with seed data and AI_PROVIDER=mock.
 */
import "dotenv/config";
import http from "node:http";
import { execSync } from "node:child_process";

const R = [];
const ok = (n, c, i = "") => R.push([c ? "PASS" : "FAIL", n, String(i).slice(0, 180)]);

// ---------------- Part A: provider chains ----------------
const calls = { chat: 0, embed: 0, ctx: null, expand: 0 };
const mode = { content: false, expandLen: 0, geminiLong: false, geminiFail: false };
const fake = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/tags") return res.end('{"models":[]}');
    if (req.url === "/api/chat") {
      calls.chat++;
      const body = JSON.parse(b);
      calls.ctx = body.options?.num_ctx;
      const sys = String(body.messages?.[0]?.content || "");
      let content = '{"from":"ollama"}';
      if (mode.content && /You expand/.test(sys)) { calls.expand++; content = JSON.stringify({ description: mode.expandLen ? "Expanded local text. ".repeat(Math.ceil(mode.expandLen / 21)) : "still short text" }); }
      else if (mode.content) content = JSON.stringify({ title: "Short post", description: "Short ollama post about iOS apps. ".repeat(18) });
      return res.end(JSON.stringify({ model: "llama3.2", message: { content }, prompt_eval_count: 9, eval_count: 4 }));
    }
    if (req.url === "/v1/embeddings") {
      calls.embed++;
      return res.end(JSON.stringify({ data: [{ embedding: Array(768).fill(0.1) }] }));
    }
    res.statusCode = 404;
    res.end("{}");
  });
});
await new Promise((r) => fake.listen(11556, "127.0.0.1", r));

// fake Gemini: intercept only generativelanguage calls
const realFetch = globalThis.fetch;
let geminiCalls = 0;
globalThis.fetch = async (url, opt) => {
  if (String(url).includes("generativelanguage.googleapis.com")) {
    geminiCalls++;
    if (mode.geminiFail) return new Response(JSON.stringify({ error: { code: 404, message: "models/gemini-x is not found" } }), { status: 404, headers: { "content-type": "application/json" } });
    if (String(url).includes(":embedContent")) return new Response(JSON.stringify({ embedding: { values: Array(768).fill(0.2) } }), { headers: { "content-type": "application/json" } });
    const text = mode.geminiLong ? JSON.stringify({ title: "Gemini post", description: "Detailed Gemini post text for local customers. ".repeat(30) }) : '{"from":"gemini"}';
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 } }), { headers: { "content-type": "application/json" } });
  }
  return realFetch(url, opt);
};

Object.assign(process.env, {
  AI_PROVIDER: "auto",
  IMAGE_PROVIDER: "",
  OLLAMA_ENABLED: "1", // Admin -> Integrations writes "1"
  OLLAMA_BASE_URL: "http://127.0.0.1:11556", // no /v1 on purpose
  GEMINI_API_KEY: "test-key",
  GEMINI_IMAGE_MODEL: "gemini-2.5-flash-image",
  OPENAI_API_KEY: "sk-test",
  AI_MAX_RETRIES: "2",
});

const ai = await import("../lib/ai/index.js");
let chain = ai.getProviderChain().map((p) => p.name);
ok("text chain: ollama -> gemini -> openai -> mock", chain.join(">") === "ollama>gemini>openai>mock", chain.join(">"));
ok("OLLAMA_ENABLED=1 accepted", chain[0] === "ollama");
ok("images: Gemini only", ai.getImageChain().map((p) => p.name).join(",") === "gemini", ai.getImageChain().map((p) => p.name).join(","));

let r = await ai.runAI({ agent: "research", system: "s", prompt: "p" });
ok("text runs on Ollama", r.provider === "ollama" && r.data?.from === "ollama", JSON.stringify(r.data));
ok("Ollama num_ctx 8192 + base URL without /v1 works", calls.ctx === 8192 && calls.chat === 1, calls.ctx);
const v = await ai.embed("hello");
ok("embeddings on Ollama", calls.embed === 1 && v.length === 768);

// Ollama goes down -> straight to Gemini, no retries on Ollama
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11999";
const t0 = Date.now();
r = await ai.runAI({ agent: "research", system: "s", prompt: "p" });
ok("Ollama down -> Gemini", r.provider === "gemini" && r.data?.from === "gemini", r.provider);
ok("fallback is fast (no retry wait)", Date.now() - t0 < 4000, `${Date.now() - t0} ms`);
const g0 = geminiCalls;
await ai.embed("hello again");
ok("embeddings fall back to Gemini", geminiCalls === g0 + 1);

// AI_PROVIDER=ollama keeps Gemini as safety net; disabled Ollama -> Gemini for all
process.env.AI_PROVIDER = "ollama";
ok("AI_PROVIDER=ollama -> ollama>gemini>mock", ai.getProviderChain().map((p) => p.name).join(">") === "ollama>gemini>mock", ai.getProviderChain().map((p) => p.name).join(">"));
process.env.AI_PROVIDER = "auto";
process.env.OLLAMA_ENABLED = "false";
r = await ai.runAI({ agent: "content", system: "s", prompt: "p" });
ok("Ollama off -> Gemini for text", r.provider === "gemini");
process.env.IMAGE_PROVIDER = "auto";
ok("IMAGE_PROVIDER=auto restores Gemini>OpenAI", ai.getImageChain().map((p) => p.name).join(">") === "gemini>openai");
process.env.IMAGE_PROVIDER = "";
process.env.GEMINI_API_KEY = "";
ok("no Gemini key -> no image provider (placeholder/branded only)", ai.getImageChain().length === 0);
// ---- short Ollama posts: expand, then Gemini safety net ----
process.env.GEMINI_API_KEY = "test-key";
process.env.OLLAMA_ENABLED = "true";
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11556";
process.env.OPENAI_API_KEY = "";

const { runContentAgent } = await import("../lib/ai/agents/content.js");
const { withEngine } = await import("../lib/ai/engine.js");
const { DESC_MIN_CHARS } = await import("../lib/ai/textPolicy.js");
const { buildKnowledge } = await import("../lib/repo/knowledge.js");
const kb = await buildKnowledge(1);
const input = { topic: "iOS App Development", primaryKeyword: "ios app development", secondaryKeywords: [], tertiaryKeywords: [], postType: "Service", avoidTitles: [], avoidOpenings: [] };
// Ollama was marked down by the earlier test - reset its state by waiting out / re-pinging
const { OllamaProvider } = await import("../lib/ai/providers/ollama.js");
const op = new OllamaProvider();
for (let i = 0; i < 70 && !(await op.available()); i++) await new Promise((r) => setTimeout(r, 1000));
mode.content = true; mode.expandLen = 1300; mode.geminiLong = true;
let g1 = geminiCalls;
let c = await withEngine("ollama", () => runContentAgent(kb, input, { seed: "t1" }));
ok("short Ollama post -> expanded on Ollama to >= 1200", c.description.length >= DESC_MIN_CHARS && calls.expand >= 1 && geminiCalls === g1, `${c.description.length} chars, expand=${calls.expand}, gemini=${geminiCalls - g1}`);
mode.expandLen = 0;
g1 = geminiCalls;
c = await withEngine("ollama", () => runContentAgent(kb, input, { seed: "t2" }));
ok("expand still short -> one Gemini call fixes it", c.description.length >= DESC_MIN_CHARS && geminiCalls === g1 + 1, `${c.description.length} chars, gemini=${geminiCalls - g1}`);
process.env.OLLAMA_SHORT_FALLBACK = "off";
g1 = geminiCalls;
c = await withEngine("ollama", () => runContentAgent(kb, input, { seed: "t3" }));
ok("OLLAMA_SHORT_FALLBACK=off -> no Gemini call", geminiCalls === g1, `${c.description.length} chars`);
process.env.OLLAMA_SHORT_FALLBACK = "";
mode.content = false;

// ---- engine choice: background = Ollama, manual pick = that engine ----
r = await ai.runAI({ agent: "research", system: "s", prompt: "p" });
ok("background run (no engine) -> Ollama", r.provider === "ollama", r.provider);
r = await withEngine("gemini", () => ai.runAI({ agent: "research", system: "s", prompt: "p" }));
ok("manual pick Gemini -> Gemini even when Ollama is up", r.provider === "gemini", r.provider);
const ge0 = geminiCalls;
await withEngine("gemini", () => ai.embed("x"));
ok("manual Gemini -> embeddings on Gemini too", geminiCalls === ge0 + 1);
r = await withEngine("ollama", async () => { await new Promise((z) => setTimeout(z, 5)); return ai.runAI({ agent: "research", system: "s", prompt: "p" }); });
ok("manual pick Ollama -> Ollama (survives awaits)", r.provider === "ollama", r.provider);
const both = await Promise.all([withEngine("gemini", () => ai.runAI({ agent: "a", system: "s", prompt: "p" })), ai.runAI({ agent: "b", system: "s", prompt: "p" })]);
ok("parallel runs keep their own engine", both[0].provider === "gemini" && both[1].provider === "ollama", both.map((x) => x.provider).join(","));

// hybrid (background default): post text on Gemini, the rest on Ollama
r = await ai.runAI({ agent: "content", system: "s", prompt: "p" });
ok("background = hybrid: content -> Gemini", r.provider === "gemini", r.provider);
r = await ai.runAI({ agent: "humanize", system: "s", prompt: "p" });
ok("hybrid: humanize -> Gemini", r.provider === "gemini", r.provider);
r = await ai.runAI({ agent: "keywords", system: "s", prompt: "p" });
ok("hybrid: keywords/topic/QA -> Ollama", r.provider === "ollama", r.provider);
const ge1 = geminiCalls;
await ai.embed("y");
ok("hybrid: embeddings on Ollama", geminiCalls === ge1);
r = await withEngine("ollama", () => ai.runAI({ agent: "content", system: "s", prompt: "p" }));
ok("manual Ollama: content on Ollama", r.provider === "ollama", r.provider);
r = await withEngine("hybrid", () => ai.runAI({ agent: "content", system: "s", prompt: "p" }));
ok("manual Hybrid: content on Gemini", r.provider === "gemini", r.provider);
process.env.AI_BACKGROUND_ENGINE = "ollama";
r = await ai.runAI({ agent: "content", system: "s", prompt: "p" });
ok("AI_BACKGROUND_ENGINE=ollama -> content on Ollama", r.provider === "ollama", r.provider);
process.env.AI_BACKGROUND_ENGINE = "";

// Gemini fails in hybrid -> Ollama writes it, never the Mock template
mode.geminiFail = true;
r = await ai.runAI({ agent: "content", system: "s", prompt: "p" });
ok("hybrid + Gemini down -> content falls back to Ollama (not Mock)", r.provider === "ollama" && /not found/.test(r.fallbackReason || ""), `${r.provider} / ${r.fallbackReason}`);
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11998"; // Ollama down too
let thrown = null;
try { await runContentAgent(kb, input, { seed: "allfail" }); } catch (e) { thrown = e.message; }
ok("all AI down -> task fails with reason, no template post", Boolean(thrown) && /all providers failed/.test(thrown), thrown);
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11556";
mode.geminiFail = false;

fake.close();
globalThis.fetch = realFetch;

// ---------------- Part B: one image, Regenerate keeps it (needs app) ----------------
const B = process.env.TEST_URL || "http://localhost:3258";
const up = await realFetch(B + "/api/health").then((x) => x.ok).catch(() => false);
if (up) {
  const sql = (q) => execSync(`mysql -u${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} -N -e "${q.replace(/"/g, '\\"')}"`).toString().trim();
  const login = async (e, p) => {
    const res = await realFetch(B + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: e, password: p }) });
    return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  };
  const owner = await login("owner@hovermedia.in", "owner123");
  const act = async (id, body) => {
    const res = await realFetch(`${B}/api/tasks/${id}`, { method: "POST", headers: { cookie: owner, "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  const gen = await realFetch(`${B}/api/ai/nightly`, { method: "POST", headers: { "x-scheduler-key": process.env.SESSION_SECRET, "content-type": "application/json" } }).catch(() => null);
  void gen;
  const id = sql("INSERT INTO ai_tasks (tenant_id, client_id, status, post_type, topic, scheduled_date) VALUES (1,1,'PENDING','Service','Regenerate test',CURDATE()); SELECT LAST_INSERT_ID();");
  let x = await act(id, { action: "regenerate" }); // first full run (no image yet)
  const img1 = sql(`select image_url from ai_tasks where id=${id}`);
  const cand1 = Number(sql(`select count(*) from task_image_candidates where task_id=${id}`));
  ok("first run: post + exactly one image", x.status === 200 && img1 && img1 !== "NULL" && cand1 === 1, `${x.status} ${img1} candidates=${cand1} ${x.data?.error || ""}`);
  const title1 = sql(`select title from ai_tasks where id=${id}`);
  x = await act(id, { action: "regenerate" });
  const img2 = sql(`select image_url from ai_tasks where id=${id}`);
  const cand2 = Number(sql(`select count(*) from task_image_candidates where task_id=${id}`));
  ok("Regenerate: text rewritten, same image, no new image", x.status === 200 && img2 === img1 && cand2 === cand1, `${img1} -> ${img2}, candidates ${cand1}->${cand2}, title "${title1}" -> "${sql(`select title from ai_tasks where id=${id}`)}"`);
  ok("Regenerate: no image AI call logged", Number(sql(`select count(*) from ai_executions where task_id=${id} and agent='image'`)) <= 1);
  x = await act(id, { action: "generate_image_options", count: 3 });
  ok("image options capped at 1 per click", x.status === 200 && x.data?.candidates?.length === 1, x.data?.candidates?.length ?? x.data?.error);
  sql(`DELETE FROM ai_tasks WHERE id=${id}`);
  // research + keywords reused for the next post of the same client
  sql("UPDATE client_posting_plans SET status='ACTIVE', start_date=CURDATE()-INTERVAL 3 DAY, end_date=CURDATE()+INTERVAL 60 DAY, posts_per_week=500, total_posts=5000, posting_days=NULL WHERE client_id=1 AND status<>'REPLACED'");
  const mk = async () => {
    const res = await realFetch(`${B}/api/tasks`, { method: "POST", headers: { cookie: owner, "content-type": "application/json" }, body: JSON.stringify({ clientId: 1, postType: "Service" }) });
    return (await res.json().catch(() => ({}))).taskId;
  };
  const a1 = await mk();
  const a2 = await mk();
  const runs = (id, ag) => Number(sql(`select count(*) from ai_executions where task_id=${id} and agent='${ag}'`));
  ok("2nd post of a client reuses research + keywords (no AI call)", a2 && runs(a2, "research") === 0 && runs(a2, "keywords") === 0 && sql(`select research is not null from ai_tasks where id=${a2}`) === "1", `research=${runs(a2, "research")} keywords=${runs(a2, "keywords")}`);
  const before = runs(a2, "research") + runs(a2, "keywords");
  await act(a2, { action: "regenerate" });
  ok("Regenerate reuses the task's research + keywords", runs(a2, "research") + runs(a2, "keywords") === before);
  sql(`DELETE FROM ai_tasks WHERE id IN (${a1},${a2})`);
  const eng = await realFetch(`${B}/api/ai/engines`, { headers: { cookie: owner } }).then((q) => q.json()).catch(() => null);
  ok("/api/ai/engines answers for the picker", eng && "ollama" in eng && "gemini" in eng, JSON.stringify(eng));
  const t = await realFetch(`${B}/api/tasks`, { method: "POST", headers: { cookie: owner, "content-type": "application/json" }, body: JSON.stringify({ clientId: 1, postType: "Service", engine: "gemini" }) });
  const td = await t.json().catch(() => ({}));
  ok("Generate AI accepts engine", t.status === 200 && td.taskId, td.error);
  if (td.taskId) sql(`DELETE FROM ai_tasks WHERE id=${td.taskId}`);
} else {
  R.push(["SKIP", "Part B (app not running on " + B + ")", ""]);
}

for (const [s, n, i] of R) console.log(`${s.padEnd(4)}  ${n}${i ? `  [${i}]` : ""}`);
const failed = R.filter((x) => x[0] === "FAIL").length;
console.log(`\n${R.filter((x) => x[0] === "PASS").length}/${R.filter((x) => x[0] !== "SKIP").length} passed`);
process.exit(failed ? 1 : 0);
