import { CLICHES } from "./prompts/guide.js";

const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/g;
const URL = /\b(?:https?:\/\/|www\.)\S+/gi;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g;
const HASHTAG = /(^|\s)#[\p{L}\p{N}_]+/gu;
const EMOJI = /\p{Extended_Pictographic}/gu;

/** Makes AI copy safe for Google's post policy (no phones/urls/emails/hashtags, max 1 emoji). */
export function cleanPostText(text) {
  let emojis = 0;
  return String(text || "")
    .replace(URL, "")
    .replace(EMAIL, "")
    .replace(PHONE, "")
    .replace(HASHTAG, "$1")
    .replace(EMOJI, (m) => (++emojis > 1 ? "" : m))
    .replace(/\*\*|__|^#+\s*/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Deterministic policy findings used by the QA agent. */
export function policyFindings(title, description) {
  const text = `${title}\n${description}`;
  const lower = text.toLowerCase();
  const issues = [];
  const warnings = [];
  if (PHONE.test(text)) issues.push("Contains a phone number - Google rejects posts with phone numbers");
  if (/\b(?:https?:\/\/|www\.)\S+/i.test(text)) issues.push("Contains a URL - put links in the CTA button, not the text");
  if (/\b[\w.+-]+@[\w-]+\.[\w.]+\b/.test(text)) issues.push("Contains an email address");
  if (text.length > 1500) issues.push(`Too long for Google (${text.length}/1500 characters)`);
  const caps = text.match(/\b[A-Z]{4,}\b/g)?.filter((w) => !["SEO", "HVAC", "CCTV", "MRI", "ECG"].includes(w)) || [];
  if (caps.length > 1) warnings.push(`ALL-CAPS words: ${caps.slice(0, 3).join(", ")}`);
  if ((text.match(EMOJI) || []).length > 1) warnings.push("More than one emoji");
  const cliches = CLICHES.filter((c) => lower.includes(c));
  if (cliches.length) warnings.push(`Generic phrasing: ${cliches.slice(0, 3).map((c) => `"${c}"`).join(", ")}`);
  const firstSentence = String(description || "").split(/(?<=[.!?])\s/)[0] || "";
  if (firstSentence.length > 160) warnings.push("Opening sentence is long - the first ~100 characters are all users see");
  // reset global regex state
  PHONE.lastIndex = 0;
  EMOJI.lastIndex = 0;
  return { issues, warnings, clicheCount: cliches.length };
}
