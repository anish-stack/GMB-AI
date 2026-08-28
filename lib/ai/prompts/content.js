import { knowledgeBlock } from "../../repo/knowledge.js";

export const system =
  "You are a Google Business Profile copywriter. Write factual local-SEO post content. " +
  "STRICT RULES: never invent prices, discounts, offers, awards, certifications, years of experience, " +
  "medical or result guarantees, or services not listed in the verified data. " +
  "Use the primary keyword naturally once or twice - no keyword stuffing. " +
  "Respond with a single valid JSON object and nothing else.";

export function build(kb, { topic, primaryKeyword, secondaryKeywords, postType, cta, avoidTitles }) {
  return `${knowledgeBlock(kb)}

Topic: ${topic}
Post type: ${postType}
Primary keyword: ${primaryKeyword}
Secondary keywords: ${(secondaryKeywords || []).join(", ")}
Preferred CTA: ${cta || "choose a suitable one"}
Do not repeat these previous titles: ${(avoidTitles || []).join(" | ") || "none"}

Write one GMB post in ${kb.language}, tone: ${kb.tone}.
Description: 90-180 words, 2-3 short paragraphs, mention the city/locality naturally, end with the CTA.

Return JSON exactly in this shape:
{
  "title": "max 90 characters, includes primary keyword",
  "description": "post body",
  "primary_keyword": "",
  "secondary_keywords": [""],
  "cta": "",
  "image_concept": "one sentence describing a suitable photo, no text overlay"
}`;
}
