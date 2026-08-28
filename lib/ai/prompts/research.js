import { knowledgeBlock } from "../../repo/knowledge.js";

export const system =
  "You are a local SEO research analyst. You may only use the verified client data provided. " +
  "Never invent prices, awards, certifications, guarantees, offers or services. " +
  "Respond with a single valid JSON object and nothing else.";

export function build(kb) {
  return `${knowledgeBlock(kb)}

Research this business for Google Business Profile content planning.

Return JSON exactly in this shape:
{
  "summary": "2-3 sentences about the business",
  "audience": "who searches for this business locally",
  "differentiators": ["max 4 items, only from verified services/description"],
  "local_context": "how location affects search intent",
  "content_opportunities": ["max 5 GMB post angles"],
  "verified_facts": { "business": "", "category": "", "phone": "", "website": "", "services": [] }
}`;
}
