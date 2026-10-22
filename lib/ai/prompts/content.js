import { knowledgeBlock } from "../../repo/knowledge.js";
import { GBP_RULES, WRITING_RULES, SEARCH_INTENT, seasonContext } from "./guide.js";
import { DESC_MIN_CHARS, DESC_MAX_CHARS, HEADLINE_MAX_WORDS, GBP_CTAS } from "../textPolicy.js";

export const system =
  "You are the owner of a local trade business, writing a short update for regular customers. " +
  "You write the way you talk across the counter: direct, specific, a little blunt, never salesy. " +
  "You only state facts that appear in the approved business facts. " +
  "You never invent prices, years in business, guarantees, awards, staff names, or customer stories. " +
  "Respond with a single valid JSON object and nothing else.";

/** Voice & banned-words block - editable by the admin (AI prompts). */
export const CONTENT_VOICE = `VOICE
- Write like you are speaking to a neighbor. Contractions are fine. Fragments are fine.
- Mix sentence lengths. Some sentences are 3-5 words. Others run longer. Do not balance paragraphs evenly.
- Use concrete details from the approved facts: the actual service, the real area, the real problem. If the facts do not support a detail, leave it out.
- No transition words like "Furthermore", "Moreover", "Additionally", "In conclusion".
- Never start with "Looking for", "Are you looking for" or "Searching for". Start with the problem, a situation or a plain fact.
- Never mention opening hours, timings, days open or "open 10am to 7pm" - Google already shows the hours.
- No stock openers or closers: "Look no further", "In today's world", "Whether you need X or Y", "Don't hesitate to", "We pride ourselves", "Your satisfaction is our priority".
- Banned words: testament, delve, navigating, elevate, bespoke, realm, game-changer, tapestry, crucial, paramount, beacon, seamless, comprehensive, tailored, unparalleled, top-notch, in summary.
- No lists of three adjectives. No rhetorical "not just X, but Y" constructions.
- Write city and area names in normal capitalisation, for example Delhi or Sector 99A. Never in ALL CAPS`;

const TYPE_HINTS = {
  Offer:
    "Mention a deal only if it is explicitly in the approved facts. Otherwise explain what the customer gets for their money.",
  Service:
    "Talk about one specific service: what gets fixed, who does it, and what happens when someone calls.",
  Educational:
    "Share one practical tip, one common mistake, or one warning sign. Keep it grounded.",
  Local:
    "Write like a resident who knows the streets, the weather, and the real hassles of the area.",
  Seasonal:
    "Say how the current season or weather is affecting homes or vehicles right now.",
  Promotional:
    "State the plain value of the service. No pitch language.",
  FAQ:
    "Open by answering a blunt question a real customer would ask.",
  Awareness:
    "Point out a problem people ignore until it gets expensive.",
  "Product/Service Highlight":
    "Focus on one specific situation where this service saves the day.",
};

// Rotated per call so consecutive posts do not share the same skeleton.
const OPENING_SHAPES = [
  "Open with a short, blunt statement of the problem (under 10 words).",
  "Open with a question a customer would actually ask on the phone.",
  "Open with a specific situation (a time of day, a symptom, a weather event).",
  "Open with a mistake you keep seeing and what it costs people.",
  "Open with what you tell customers first when they call about this.",
];

const BODY_SHAPES = [
  "3 paragraphs: problem, what you do about it, how to reach out.",
  "4 paragraphs: situation, why it happens, what you do, next step.",
  "3 paragraphs: one long, one very short (a single line), one medium.",
  "4 paragraphs: short, long, short, medium.",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const quoteList = (arr) => (arr || []).filter(Boolean).map((s) => `"${s}"`).join(" | ");

export function build(
  kb,
  { topic, primaryKeyword, secondaryKeywords, tertiaryKeywords, postType, cta, avoidTitles, avoidOpenings, avoidText },
) {
  const typeHint = TYPE_HINTS[postType] || "Clear, practical, conversational.";
  const ctaList = GBP_CTAS.map(([, label]) => `"${label}"`).join(", ");

  const avoidBlock = avoidText
    ? `\nRecent post text to avoid echoing (structure, phrases, rhythm):\n"""${avoidText}"""`
    : "";

  return `${knowledgeBlock(kb)}

${seasonContext()}

${GBP_RULES}

${WRITING_RULES}

${SEARCH_INTENT}

TASK
Topic: ${topic}
Post type: ${postType} - ${typeHint}
Primary keyword: ${primaryKeyword}
Secondary keywords: ${(secondaryKeywords || []).join(", ") || "none"}
Tertiary (long-tail / local) keywords: ${(tertiaryKeywords || []).join(", ") || "none"}
Preferred CTA: ${cta || "pick what fits naturally"}
Language: ${kb.language}

AVOID REPEATING
Headlines already used (different wording and rhythm): ${(avoidTitles || []).join(" | ") || "none"}
Openings of recent posts (different structure): ${quoteList(avoidOpenings) || "none"}${avoidBlock}

SHAPE FOR THIS POST
- ${pick(OPENING_SHAPES)}
- ${pick(BODY_SHAPES)}

${CONTENT_VOICE}

GOOGLE POST FORMAT
- No title. Write only the post text in "description".
- "description": ${DESC_MIN_CHARS}-${DESC_MAX_CHARS} characters including spaces. Paragraphs separated by a blank line.
- No hashtags, no phone numbers, no URLs, no emojis.
- "image_headline": ${HEADLINE_MAX_WORDS} words or fewer, at least 4. Short overlay text for the image.
- "cta": exactly one of: ${ctaList}.

KEYWORDS
- Use the primary keyword in the first sentence and once more later, in natural phrasing.
- Work in secondary and tertiary keywords only where a person would say them. Skip any that do not fit.
- No keyword stuffing. Never repeat the same keyword phrase more than twice.

SELF-CHECK BEFORE ANSWERING
1. Every claim comes from the approved facts.
2. Description length is inside ${DESC_MIN_CHARS}-${DESC_MAX_CHARS} characters.
3. No banned word, no stock phrase, no emoji, no phone number, no URL, no opening hours / timings, no "Looking for" opening.
4. City names are not in ALL CAPS.
5. The opening differs from the recent openings listed above.

Return JSON in exactly this shape (one flat object):
{
  "angle": "one line: search-intent lens plus the specific human angle",
  "image_headline": "4-${HEADLINE_MAX_WORDS} words for the image",
  "description": "post text, ${DESC_MIN_CHARS}-${DESC_MAX_CHARS} characters, city names in normal capitalisation",
  "primary_keyword": "",
  "secondary_keywords": ["1-3 items"],
  "tertiary_keywords": ["1-3 local / long-tail items"],
  "cta": "one of the allowed button labels",
  "image_subtitle": "max 60 characters supporting line for the image",
  "image_concept": "one sentence: a realistic photo concept, no text, no logos"
}`;
}