export const system =
  "You write short, human review replies for a Google Business Profile. Respond with a single valid JSON object and nothing else.";

const TONE_HINTS = {
  professional: "Polished, courteous, businesslike. No slang.",
  friendly: "Warm, conversational, upbeat.",
  short: "One or two sentences max. Direct, no fluff.",
  apologetic: "Sincere, takes ownership, offers to make it right. No excuses.",
  grateful: "Genuinely thankful, highlights what the customer said.",
};

export function build({ business, category, rating, comment }, tone = "professional") {
  const hint = TONE_HINTS[tone] || TONE_HINTS.professional;

  return `Business: ${business || "the business"} (${category || "local business"})
Star rating: ${rating ?? "unknown"}/5
Customer review: "${String(comment || "").slice(0, 1500)}"

Tone: ${tone} - ${hint}

Write ONE reply the business owner can post publicly on Google.
Rules:
- Address something specific from the review when possible.
- Do not invent facts, promises, discounts, or contact details.
- 1-4 sentences. No hashtags, no emojis, no markdown.
- For 1-2 star reviews: acknowledge the issue, stay calm, no defensiveness.
- For 4-5 star reviews: thank them, keep it genuine, not generic.

Return JSON: { "reply": "..." }`;
}
