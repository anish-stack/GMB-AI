import { knowledgeBlock } from "../../repo/knowledge.js";
import { GBP_RULES, WRITING_RULES, SEARCH_INTENT, seasonContext } from "./guide.js";
import { DESC_MIN_CHARS, DESC_MAX_CHARS, HEADLINE_MAX_WORDS, GBP_CTAS } from "../textPolicy.js";

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

export function build(kb, { topic, primaryKeyword, secondaryKeywords, tertiaryKeywords, postType, cta, avoidTitles }) {
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
Tertiary (long-tail / local) keywords: ${(tertiaryKeywords || []).join(", ") || "none"}
Preferred CTA: ${cta || "choose one that matches the intent (Book, Call now, Get directions, Learn more)"}
Titles already used (do not reuse their wording or angle): ${(avoidTitles || []).join(" | ") || "none"}
Language: ${kb.language}. Tone: ${kb.tone}.

GOOGLE POST FORMAT (Update post):
- There is NO title on Google posts - write ONLY the post text ("description").
- description: ${DESC_MIN_CHARS}-${DESC_MAX_CHARS} characters including spaces (about 200-250 words). Never below ${DESC_MIN_CHARS}, never above ${DESC_MAX_CHARS}.
- Use 3-4 short paragraphs separated by a blank line: the customer's situation -> how ${kb.business} helps (verified services only, concrete process/steps) -> why choose them (verified facts only) -> closing call to action.
- Write every city / area / locality name in CAPITALS (e.g. ${String(kb.city || "GURUGRAM").toUpperCase()}).
- NO hashtags, NO phone numbers, NO URLs, NO emojis.
- "image_headline" is a separate 4-${HEADLINE_MAX_WORDS} word headline printed ONLY on the image (not posted).
- "cta" must be EXACTLY one of: ${GBP_CTAS.map(([, l]) => `"${l}"`).join(", ")} - the button Google shows under the post.

KEYWORD USE:
- Primary keyword in the first sentence and once more later, naturally.
- Each secondary and tertiary keyword appears once, naturally.
- No keyword stuffing.

PROCESS
1. Decide the search intent lens and one fresh angle not used in recent posts.
2. Write the description, count the characters (${DESC_MIN_CHARS}-${DESC_MAX_CHARS}), fix it if outside the range.
3. Pick the button that matches the goal (Call now / Book / Order online / Buy / Learn more / Sign up / None).

Return JSON exactly in this shape (one flat object):
{
  "angle": "one line: intent lens + the specific angle",
  "image_headline": "4-${HEADLINE_MAX_WORDS} words for the image",
  "description": "${DESC_MIN_CHARS}-${DESC_MAX_CHARS} characters, city names in CAPITALS",
  "primary_keyword": "",
  "secondary_keywords": ["1-3 items"],
  "tertiary_keywords": ["1-3 local / long-tail items"],
  "cta": "one of the allowed button labels",
  "image_subtitle": "max 60 characters supporting line for the image",
  "image_concept": "one sentence: a realistic photo that matches this post, no text, no signage, no logos, no phone numbers"
}}`;
}