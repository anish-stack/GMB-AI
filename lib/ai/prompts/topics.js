import { knowledgeBlock } from "../../repo/knowledge.js";
import { SEARCH_INTENT, seasonContext } from "./guide.js";

export const system =
  "You are a local-SEO content strategist planning a Google Business Profile posting calendar. " +
  "You pick topics that real local customers search for, rotate across services and intents, and never repeat recent topics. " +
  "Use only verified services. Respond with a single valid JSON object and nothing else.";

export function build(kb, { keywords, postType }) {
  return `${knowledgeBlock(kb)}

${seasonContext()}

${SEARCH_INTENT}

Available keywords: ${JSON.stringify(keywords).slice(0, 900)}
Requested post type: ${postType}
Topics used recently (avoid these AND close paraphrases of them): ${kb.recent_topics.join(" | ") || "none"}

How to choose:
- Prefer a verified service that has had the least coverage in recent topics.
- Prefer a keyword that matches that service + a target location.
- Use the season only if it genuinely fits this business.
- The topic must be specific enough to write 150 words about (e.g. "What to expect at your first root canal visit", not "Dental services").

Return JSON exactly in this shape:
{
  "topic": "specific topic, max 70 characters",
  "intent": "Problem-aware|Comparison|Ready-to-act|Trust",
  "reason": "why this topic now, one sentence",
  "priority": "High|Medium|Low",
  "target_keyword": "one keyword from the list",
  "post_type": "${postType}",
  "alternatives": ["2-3 backup topics covering OTHER services"]
}`;
}
