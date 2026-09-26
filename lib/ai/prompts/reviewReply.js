export const system =
  "You write replies to Google reviews on behalf of a local business owner. " +
  "You read the review carefully, identify what the customer actually said, and respond like a real, calm, caring owner. " +
  "Respond with a single valid JSON object and nothing else.";

const TONE_HINTS = {
  professional: "Polished, courteous, businesslike. No slang.",
  friendly: "Warm, conversational, upbeat.",
  short: "One or two sentences. Direct, no fluff.",
  apologetic: "Sincere, takes ownership, offers to make it right. No excuses, no blame.",
  grateful: "Genuinely thankful, highlights what the customer liked.",
};

/** Hindi (Devanagari) or common Hinglish words -> reply in the same register. */
export function detectLanguage(text = "") {
  if (/[\u0900-\u097F]/.test(text)) return "Hindi (Devanagari script)";
  if (/\b(bahut|accha|acha|achha|bhai|sir ji|kaafi|bohot|nahi|hai|tha|karo|kiya|mast|badiya|badhiya)\b/i.test(text)) {
    return "Hinglish (Hindi in Roman script, mixed with English)";
  }
  return "English";
}

export function build({ business, category, city, services, reviewer, rating, comment, prohibited }, tone = "professional") {
  const hint = TONE_HINTS[tone] || TONE_HINTS.professional;
  const stars = Number(rating) || 0;
  const firstName = String(reviewer || "").trim().split(/\s+/)[0];
  const lang = detectLanguage(comment);
  const situation =
    !comment ? "Rating only, no text: keep it short, thank them, invite them back. Do not invent details."
      : stars <= 2 ? "Negative review: acknowledge the specific issue, apologise for the experience (not for facts you can't verify), say what you'll look into, and invite them to reach out to the business directly. Never argue, never reveal private details."
      : stars === 3 ? "Mixed review: thank them for the positives, acknowledge the concern specifically, show you'll improve."
      : "Positive review: thank them and reflect back one specific thing they liked. Invite them back.";

  return `Business: ${business || "the business"} (${category || "local business"}${city ? `, ${city}` : ""})
Verified services: ${(services || []).slice(0, 12).join(", ") || "not provided"}
Reviewer first name: ${firstName || "not shown"}
Star rating: ${stars || "unknown"}/5
Customer review: """${String(comment || "").slice(0, 1500)}"""

Tone: ${tone} - ${hint}
Situation: ${situation}
Reply language: ${lang}

Rules:
- Use the reviewer's first name once if available.
- Refer to something specific from the review; never copy it word-for-word.
- Do not invent facts, promises, discounts, phone numbers, emails or links.
- Never confirm or mention health conditions, treatments or personal details of the customer (privacy).
- ${prohibited?.length ? `Never use: ${prohibited.join(", ")}.` : "No superlatives about the business."}
- No hashtags, no emojis, no markdown, no "Dear valued customer", no mention of AI.
- Sign off naturally as the team (e.g. "- Team ${business || "us"}") only if it reads naturally.

Return JSON: { "reply": "..." }`;
}
