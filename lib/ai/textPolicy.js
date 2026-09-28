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
  if (String(description || "").length > DESC_MAX_CHARS) issues.push(`Description is ${String(description).length} characters - Google allows ${DESC_MAX_CHARS}`);
  if (String(description || "").length < DESC_MIN_CHARS) warnings.push(`Description is ${String(description).length} characters - aim for ${DESC_MIN_CHARS}-${DESC_MAX_CHARS}`);
  if (/(^|\s)#[\p{L}\p{N}_]+/u.test(text)) issues.push("Contains hashtags - remove them");
  // (ALL-CAPS check removed: city / area names are intentionally written in CAPITALS)
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


/* ---------- GBP post rules used across the app ----------
 * Google "Update" posts have NO title - only the description is published.
 * The short headline we generate is printed on the IMAGE only.
 * Change limits here only - prompts, AI trimming, humanizer, QA and the
 * review screen all read these values.
 */
export const DESC_MIN_CHARS = 1200;
export const DESC_MAX_CHARS = 1500; // Google's hard limit for a post
export const HEADLINE_MAX_WORDS = 8; // image headline
export const HEADLINE_MAX_CHARS = 60;
export const IMAGE_TITLE_MAX_CHARS = HEADLINE_MAX_CHARS;
export const GOOGLE_MAX_CHARS = DESC_MAX_CHARS;

/** Exactly the button options Google offers for posts. [actionType, label] */
export const GBP_CTAS = [
  ["NONE", "None"],
  ["BOOK", "Book"],
  ["ORDER", "Order online"],
  ["SHOP", "Buy"],
  ["LEARN_MORE", "Learn more"],
  ["SIGN_UP", "Sign up"],
  ["CALL", "Call now"],
];
const CTA_BY_LABEL = new Map(GBP_CTAS.map(([t, l]) => [l.toLowerCase(), l]));

/** Any AI/free text -> one of Google's 7 button labels. */
export function normalizeCta(v) {
  const t = String(v || "").trim().toLowerCase();
  if (!t) return "Learn more";
  if (CTA_BY_LABEL.has(t)) return CTA_BY_LABEL.get(t);
  const hit = GBP_CTAS.find(([type]) => type.toLowerCase() === t.replace(/\s+/g, "_"));
  if (hit) return hit[1];
  if (/\bnone|no button\b/.test(t)) return "None";
  if (/\b(call|phone|ring|whatsapp)\b/.test(t)) return "Call now";
  if (/\b(book|appointment|reserve|schedule|visit)\b/.test(t)) return "Book";
  if (/\b(order|delivery|takeaway)\b/.test(t)) return "Order online";
  if (/\b(buy|shop|purchase)\b/.test(t)) return "Buy";
  if (/\b(sign ?up|register|join|enrol|enroll|subscribe)\b/.test(t)) return "Sign up";
  return "Learn more";
}

export const countWords = (text) => (String(text || "").trim().match(/\S+/g) || []).length;

/** Cuts at a word boundary, never mid-word, never over `max` characters. */
export function fitText(text, max) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : t.slice(0, max)).replace(/[\s,;:–-]+$/, "");
}

/** Keeps at most `maxWords` words (and `maxChars` characters). */
export function fitWords(text, maxWords, maxChars = Infinity) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const out = words.slice(0, maxWords).join(" ").replace(/[\s,;:–-]+$/, "");
  return out.length > maxChars ? fitText(out, maxChars) : out;
}

/** Description <= maxChars, cut on whole sentences (paragraph breaks kept). */
export function fitDescription(text, maxChars = DESC_MAX_CHARS) {
  const t = String(text || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length <= maxChars) return t;
  const parts = t.match(/[^.!?]+[.!?]+(\s+|$)/g) || [];
  let out = "";
  for (const s of parts) {
    if ((out + s).trimEnd().length > maxChars) break;
    out += s;
  }
  out = out.trim();
  return out.length >= maxChars * 0.6 ? out : `${fitText(t, maxChars - 1)}.`;
}

/** City / area names in CAPITALS inside the description (client requirement). */
export function capsPlaces(text, places = []) {
  let out = String(text || "");
  const list = [...new Set(places.map((p) => String(p || "").trim()).filter((p) => p.length >= 3))].sort((a, b) => b.length - a.length);
  for (const p of list) {
    const re = new RegExp(`(^|[^\\p{L}])(${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^\\p{L}])`, "giu");
    out = out.replace(re, (m, pre, name) => pre + name.toUpperCase());
  }
  return out;
}

/** headline (image only) + description (published). */
export function fitPost(headline, description) {
  return { title: fitWords(headline, HEADLINE_MAX_WORDS, HEADLINE_MAX_CHARS), description: fitDescription(description) };
}

// backwards-compatible names used by older code paths
export const POST_TITLE_MAX_WORDS = HEADLINE_MAX_WORDS;
export const POST_DESC_MAX_WORDS = 250;
export const POST_DESC_MIN_WORDS = 0;
export const POST_TITLE_MAX = HEADLINE_MAX_CHARS;
export const POST_DESC_MAX = DESC_MAX_CHARS;
export const fitSentences = (text, max) => fitDescription(text, max);
export const fitSentencesWords = (text, _w, maxChars) => fitDescription(text, maxChars);