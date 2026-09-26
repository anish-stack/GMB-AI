import { knowledgeBlock } from "../../repo/knowledge.js";

export const system =
  "You are a local SEO keyword strategist for Indian local businesses. Use only the verified client data. " +
  "You have NO search volume data - never state or imply search volume. " +
  "Reply with one valid JSON object, nothing else. Be brief.";

export function build(kb, research) {
  return `${knowledgeBlock(kb)}${research ? `\n\nResearch notes: ${JSON.stringify(research).slice(0, 500)}` : ""}

Generate Google Business Profile keyword candidates the way real customers type or speak them.
Rules:
- Every keyword = a real service or the category + a real target location, or a "near me" / intent modifier
  (e.g. "root canal treatment indirapuram", "emergency ambulance near me ghaziabad", "ac repair cost noida" only if cost is a natural search).
- Lowercase, no brand names of competitors, no invented services.
- Mix intents: service+location, problem-based, "near me", question-style long tail.
- relevance_score is 0-100 = how closely it matches a verified service AND location (not volume).
- Keep every "reason" under 12 words.

JSON shape (exactly 2 items per group, no extra fields):
{
  "primary_keywords":   [{"keyword":"","reason":"","relevance_score":0,"priority":"HIGH"}],
  "secondary_keywords": [{"keyword":"","reason":"","relevance_score":0,"priority":"MEDIUM"}],
  "long_tail_keywords": [{"keyword":"","reason":"","relevance_score":0,"priority":"MEDIUM"}],
  "location_keywords":  [{"keyword":"","reason":"","relevance_score":0,"priority":"MEDIUM"}]
}`;
}
