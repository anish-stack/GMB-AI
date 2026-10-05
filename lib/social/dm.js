import { query, one, insert } from "../db.js";
import { decryptToken } from "../gmb/googleAuth.js";
import { sendInstagramMessage } from "./meta.js";
import { runAI } from "../ai/index.js";
import { buildKnowledge } from "../repo/knowledge.js";
import { rateLimit } from "../security/rateLimit.js";

/**
 * Instagram DM auto-reply (webhook "messages"):
 *   1. keyword rule (first match)        -> rule reply
 *   2. else AI reply from verified business facts (if enabled)
 *   3. else the fallback text (if set)
 * Max 3 automatic replies per person per 10 minutes. Everything is logged.
 */
const norm = (s) => String(s || "").toLowerCase();

async function aiReply(clientId, text) {
  const kb = await buildKnowledge(clientId).catch(() => null);
  if (!kb) return null;
  const { data } = await runAI({
    agent: "dm_reply",
    system: "You answer Instagram direct messages for a local business. Friendly, short (max 3 sentences), same language as the customer (Hindi / Hinglish / English). Use ONLY the facts given. Never invent prices, offers or availability. If you don't know, ask them to call or share details. Respond with JSON { \"reply\": \"...\" }.",
    prompt: `Business: ${kb.business} (${kb.category}) in ${kb.city}
Services: ${(kb.services || []).slice(0, 12).join(", ")}
Phone: ${kb.phone || "-"} · Website: ${kb.website || "-"}
Customer message: """${String(text).slice(0, 600)}"""`,
    meta: { agent: "dm_reply" },
    clientId,
    maxTokens: 1024,
    temperature: 0.5,
  });
  const r = String(data?.reply || "").trim();
  return r || null;
}

export async function handleInstagramEvent(entry) {
  const igId = String(entry.id || "");
  for (const ev of entry.messaging || []) {
    if (!ev.message || ev.message.is_echo) continue;
    const sender = String(ev.sender?.id || "");
    const targetIg = String(ev.recipient?.id || igId);
    if (!sender || sender === targetIg) continue;
    const a = await one(
      `SELECT s.*, t.social_enabled FROM social_accounts s JOIN tenants t ON t.id=s.tenant_id
        WHERE s.platform='instagram' AND s.ig_user_id IN (?,?) AND s.status='ACTIVE' LIMIT 1`,
      [targetIg, igId],
    );
    if (!a || !Number(a.social_enabled) || !Number(a.dm_auto_reply)) continue;
    const text = ev.message.text || "";
    const rl = await rateLimit(`igdm:${a.id}:${sender}`, { max: 3, windowSec: 600 }).catch(() => ({ allowed: true }));
    if (!rl.allowed) {
      await insert("ig_dm_log", { client_id: a.client_id, sender_id: sender, message: text, source: "NONE", error: "rate limited (3 auto replies / 10 min)" });
      continue;
    }
    let reply = null;
    let source = "NONE";
    let ruleId = null;
    if (text) {
      const rules = await query("SELECT id, keywords, reply FROM ig_dm_rules WHERE client_id=? AND active=1 ORDER BY id", [a.client_id]);
      const hit = rules.find((r) => r.keywords.split(",").map((k) => norm(k).trim()).filter(Boolean).some((k) => norm(text).includes(k)));
      if (hit) {
        reply = hit.reply;
        source = "RULE";
        ruleId = hit.id;
      } else if (Number(a.dm_use_ai)) {
        reply = await aiReply(a.client_id, text).catch(() => null);
        if (reply) source = "AI";
      }
    }
    if (!reply && a.dm_fallback) {
      reply = a.dm_fallback;
      source = "FALLBACK";
    }
    if (!reply) {
      await insert("ig_dm_log", { client_id: a.client_id, sender_id: sender, message: text, source: "NONE" });
      continue;
    }
    try {
      await sendInstagramMessage({ ...a, token: decryptToken(a.access_token_enc) }, sender, reply);
      await insert("ig_dm_log", { client_id: a.client_id, sender_id: sender, message: text, reply, source, rule_id: ruleId });
    } catch (err) {
      await insert("ig_dm_log", { client_id: a.client_id, sender_id: sender, message: text, reply, source: "ERROR", rule_id: ruleId, error: String(err.message).slice(0, 480) });
    }
  }
}

export async function handleWebhook(body) {
  if (body?.object !== "instagram" && body?.object !== "page") return { ignored: body?.object || "unknown" };
  let n = 0;
  for (const entry of body.entry || []) {
    if (entry.messaging?.length) {
      await handleInstagramEvent(entry);
      n += entry.messaging.length;
    }
  }
  return { events: n };
}
