import { knowledgeBlock } from "../../repo/knowledge.js";
import { seasonContext } from "./guide.js";

export const system =
  "You are a local SEO research analyst. You may only use the verified client data provided. " +
  "Think about who searches for this business locally and why, then summarise. " +
  "Never invent prices, awards, certifications, guarantees, offers or services. " +
  "Respond with a single valid JSON object and nothing else.";

export function build(kb) {
  return `${knowledgeBlock(kb)}

${seasonContext()}

Research this business for Google Business Profile content planning.
Think about: the customer's situation before they search, the questions they ask, what makes them choose one local business over another,
and what the verified facts let us say honestly.

Return JSON exactly in this shape:
{
  "summary": "2-3 sentences about the business",
  "audience": "who searches for this business locally and in what situation",
  "customer_questions": ["max 5 real questions customers ask before choosing"],
  "differentiators": ["max 4 items, only from verified services/description/approved claims"],
  "local_context": "how the location affects search intent",
  "content_opportunities": ["max 5 specific GMB post angles"],
  "verified_facts": { "business": "", "category": "", "phone": "", "website": "", "services": [] }
}`;
}
