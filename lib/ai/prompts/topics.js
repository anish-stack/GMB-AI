import { knowledgeBlock } from "../../repo/knowledge.js";

export const system =
  "You are a GMB content planner. Pick one topic that has not been used recently. " +
  "Use only verified services. Respond with a single valid JSON object and nothing else.";

export function build(kb, { keywords, postType }) {
  return `${knowledgeBlock(kb)}

Available keywords: ${JSON.stringify(keywords).slice(0, 900)}
Requested post type: ${postType}
Topics already used recently (avoid these): ${kb.recent_topics.join(" | ") || "none"}

Choose the single best next GMB post topic.

Return JSON exactly in this shape:
{
  "topic": "short topic name",
  "reason": "why this topic now",
  "priority": "High|Medium|Low",
  "target_keyword": "one keyword from the list",
  "post_type": "${postType}",
  "alternatives": ["2-3 backup topics"]
}`;
}
