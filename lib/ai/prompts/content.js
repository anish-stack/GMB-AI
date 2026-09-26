import { knowledgeBlock } from "../../repo/knowledge.js";
import { GBP_RULES, WRITING_RULES, SEARCH_INTENT, seasonContext } from "./guide.js";

export const system =
  "You are a senior local-SEO copywriter who writes Google Business Profile posts that get calls and direction requests. " +
  "You plan first (angle, audience, hook), then write. You only use verified facts. " +
  "Respond with a single valid JSON object and nothing else.";

const TYPE_HINTS = {
  Offer: "Only describe an offer if one is in Approved claims; otherwise write about the value of the service instead.",
  Service: "Explain one service: what it is, who needs it, what the visit/process looks like.",
  Educational: "Teach one useful thing (a tip, a myth vs fact, a warning sign). Link it back to the service.",
  Local: "Tie the service to the neighbourhood: local conditions, landmarks-free, commute-friendly, local needs.",
  Seasonal: "Connect the service to the current season/festival only where it genuinely fits.",
  Promotional: "Promote the service's benefits without prices or unapproved claims.",
  FAQ: "Title is a real customer question; body answers it directly in the first sentence.",
  Awareness: "Raise awareness of a problem customers often ignore and when to act.",
  "Product/Service Highlight": "Spotlight one service/product and the specific situation it is best for.",
};

export function build(kb, { topic, primaryKeyword, secondaryKeywords, postType, cta, avoidTitles }) {
  return `${knowledgeBlock(kb)}

${seasonContext()}

${GBP_RULES}

${WRITING_RULES}

${SEARCH_INTENT}

TASK
Topic: ${topic}
Post type: ${postType} - ${TYPE_HINTS[postType] || "Useful, specific, factual."}
Primary keyword: ${primaryKeyword}
Secondary keywords: ${(secondaryKeywords || []).join(", ") || "none"}
Preferred CTA: ${cta || "choose one that matches the intent (Book, Call now, Get directions, Learn more)"}
Titles already used (do not reuse their wording or angle): ${(avoidTitles || []).join(" | ") || "none"}
Language: ${kb.language}. Tone: ${kb.tone}.

PROCESS
1. Decide the search intent lens and one fresh angle not used in recent titles.
2. Write a hook for the first 100 characters that names the customer's situation.
3. Body: 90-160 words, 2-3 short paragraphs: situation -> how ${kb.business} helps (verified services only) -> what to do next.
4. End with the CTA sentence. Re-check every hard constraint before answering.

Return JSON exactly in this shape:
{
  "angle": "one line: intent lens + the specific angle",
  "hook": "the first sentence of the body",
  "title": "max 80 characters, natural, includes the primary keyword or its core words",
  "description": "full post body (starts with the hook)",
  "primary_keyword": "",
  "secondary_keywords": [""],
  "cta": "short CTA text, 2-5 words",
  "image_concept": "one sentence: a realistic photo that matches this post, no text overlay, no logos"
}`;
}
