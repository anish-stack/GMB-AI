import { runAI } from "../index.js";
import * as keywordPrompt from "../prompts/keywords.js";
import { query, insert } from "../../db.js";
import { tenantOfClient } from "../../saas/resolve.js";

const GROUPS = {
  primary_keywords: "PRIMARY",
  secondary_keywords: "SECONDARY",
  long_tail_keywords: "LONG_TAIL",
  location_keywords: "LOCATION",
};

export async function runKeywordAgent(kb, research = null, ctx = {}) {
  const { data } = await runAI({
    agent: "keywords",
    system: keywordPrompt.system,
    prompt: keywordPrompt.build(kb, research),
    meta: { agent: "keywords", knowledge: kb, seed: ctx.seed },
    taskId: ctx.taskId,
    clientId: kb.client_id,
    maxTokens: 420,
    temperature: 0.5,
  });

  const out = {};
  for (const [group, type] of Object.entries(GROUPS)) {
    const items = Array.isArray(data?.[group]) ? data[group] : [];
    out[group] = items
      .map((k) => normalize(k, type))
      .filter((k) => k && k.keyword.length > 2)
      .slice(0, 3);
  }

  // Guarantee at least one primary keyword even if the model returned junk
  if (!out.primary_keywords.length) {
    const service = kb.services[0] || kb.category;
    const loc = kb.target_locations[0] || kb.city;
    out.primary_keywords = [
      normalize(
        {
          keyword: `${service} ${loc}`.toLowerCase(),
          reason: "Fallback: core service plus primary location",
          relevance_score: 85,
          priority: "HIGH",
        },
        "PRIMARY"
      ),
    ];
  }
  return out;
}

function normalize(k, type) {
  if (!k) return null;
  const keyword = String(k.keyword || k.term || "").toLowerCase().trim();
  if (!keyword) return null;
  return {
    keyword,
    kw_type: type,
    reason: String(k.reason || "").slice(0, 480),
    relevance_score: clamp(Number(k.relevance_score ?? k.score ?? 70)),
    priority: ["HIGH", "MEDIUM", "LOW"].includes(String(k.priority).toUpperCase())
      ? String(k.priority).toUpperCase()
      : "MEDIUM",
    source: "AI_SUGGESTED",
    has_volume_data: false, // no real search-volume source is connected
  };
}

function clamp(n) {
  if (Number.isNaN(n)) return 70;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Persist AI keyword suggestions (deduped against existing rows). */
export async function saveKeywords(clientId, grouped, tenantId = null) {
  const owner = tenantId || (await tenantOfClient(clientId));
  const existing = await query("SELECT keyword FROM keywords WHERE client_id=?", [clientId]);
  const seen = new Set(existing.map((e) => e.keyword.toLowerCase()));
  let saved = 0;
  for (const list of Object.values(grouped)) {
    for (const k of list) {
      if (seen.has(k.keyword)) continue;
      seen.add(k.keyword);
      await insert("keywords", {
        tenant_id: owner,
        client_id: clientId,
        keyword: k.keyword,
        kw_type: k.kw_type,
        source: "AI_SUGGESTED",
        reason: k.reason,
        relevance_score: k.relevance_score,
        priority: k.priority,
        has_volume_data: 0,
        search_volume: null,
      });
      saved++;
    }
  }
  return saved;
}
