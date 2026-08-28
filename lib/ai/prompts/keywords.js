import { knowledgeBlock } from "../../repo/knowledge.js";

export const system =
  "You are a local SEO keyword strategist. Use only the verified client data. " +
  "You have NO search volume data - never state or imply search volume. " +
  "Reply with one valid JSON object, nothing else. Be brief.";

export function build(kb, research) {
  return `${knowledgeBlock(kb)}${research ? `\n\nResearch notes: ${JSON.stringify(research).slice(0, 500)}` : ""}

Generate GMB keyword candidates. Each keyword must combine a real service or the category
with a real target location. Lowercase. Keep every "reason" under 12 words.

JSON shape (exactly 2 items per group, no extra fields):
{
  "primary_keywords":   [{"keyword":"","reason":"","relevance_score":0,"priority":"HIGH"}],
  "secondary_keywords": [{"keyword":"","reason":"","relevance_score":0,"priority":"MEDIUM"}],
  "long_tail_keywords": [{"keyword":"","reason":"","relevance_score":0,"priority":"MEDIUM"}],
  "location_keywords":  [{"keyword":"","reason":"","relevance_score":0,"priority":"MEDIUM"}]
}`;
}
