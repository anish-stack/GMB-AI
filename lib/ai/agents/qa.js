import { runAI } from "../index.js";
import * as qaPrompt from "../prompts/qa.js";
import { QA_PASS_SCORE } from "../../constants.js";
import { policyFindings } from "../textPolicy.js";

/** Phrases that need proof in the client record before they may appear in a post. */
const CLAIM_PATTERNS = [
  // "worry-free" / "hassle-free" are not offers, so hyphenated compounds are excluded
  { re: /\b(?:rs\.?|inr|₹)\s?\d|\b\d+\s?%\s?(?:off|discount)|(?<![\w-])free(?![\w-])/i, label: "price/offer claim" },
  { re: /\b(?:guarantee|guaranteed|100%|assured result|painless|risk[- ]free)\b/i, label: "guarantee claim" },
  { re: /\b(?:best|no\.?\s?1|number one|#1|top rated|award[- ]winning|leading)\b/i, label: "superlative claim" },
  { re: /\b(?:certified|accredited|iso|licen[cs]ed by|govt approved)\b/i, label: "certification claim" },
  { re: /\b\d+\+?\s?(?:years|yrs)\s+(?:of\s+)?experience\b/i, label: "experience claim" },
  { re: /\b(?:cure|cures|permanent solution|100 percent safe)\b/i, label: "medical claim" },
];

export async function runQAAgent(kb, post, ctx = {}) {
  const text = `${post.title}\n${post.description}`;
  const lower = text.toLowerCase();

  // ---------- deterministic checks ----------
  const businessOk = lower.includes(String(kb.business).toLowerCase().split(" ")[0]);
  const serviceOk =
    kb.services.length === 0 ||
    kb.services.some((s) => lower.includes(String(s).toLowerCase().split(" ")[0]));
  const locationOk = [kb.city, ...kb.target_locations]
    .filter(Boolean)
    .some((l) => lower.includes(String(l).toLowerCase()));

  const pk = String(post.primary_keyword || "").toLowerCase();
  const pkWords = pk.split(/\s+/).filter(Boolean);
  const keywordOk = pk ? pkWords.every((w) => lower.includes(w)) : false;
  const pkCount = pk ? countOccurrences(lower, pk) : 0;
  const maxWordCount = pkWords.length ? Math.max(...pkWords.map((w) => countOccurrences(lower, w))) : 0;
  // only real repetition counts - a keyword used 0 times is a coverage problem, not stuffing
  const stuffing = pkCount > 3 || (pkCount > 0 && maxWordCount > 6);
  const ctaOk = Boolean(post.cta) && lower.includes(String(post.cta).toLowerCase().split(" ")[0]);

  const approved = (kb.approved_claims || []).map((c) => String(c).toLowerCase());
  const unsupported = [];
  for (const { re, label } of CLAIM_PATTERNS) {
    const m = text.match(re);
    if (m && !approved.some((a) => a.includes(m[0].toLowerCase()))) {
      unsupported.push(`${label}: "${m[0]}"`);
    }
  }
  for (const banned of kb.prohibited_claims || []) {
    if (lower.includes(String(banned).toLowerCase())) unsupported.push(`prohibited phrase: "${banned}"`);
  }

  const lengthOk = post.description.split(/\s+/).length >= 40;
  const policy = policyFindings(post.title, post.description);

  // ---------- AI review (grammar / tone / extra claims) ----------
  let ai = {};
  try {
    const { data } = await runAI({
      agent: "qa",
      system: qaPrompt.system,
      prompt: qaPrompt.build(kb, post),
      meta: { agent: "qa", knowledge: kb, seed: ctx.seed },
      taskId: ctx.taskId,
      clientId: kb.client_id,
      maxTokens: 420,
      temperature: 0.2,
    });
    ai = data || {};
  } catch {
    ai = {};
  }
  // AI-flagged claims are advisory: they warn the reviewer, they do not block the post
  const aiClaims = (Array.isArray(ai.unsupported_claims) ? ai.unsupported_claims.filter(Boolean) : [])
    .map((c) => String(c).slice(0, 200))
    .slice(0, 3);

  const grammarOk = ai.grammar_ok !== false;
  const duplicateRisk = Boolean(ctx.duplicate);

  // ---------- score ----------
  let score = 100;
  const issues = [];
  const warnings = [];

  if (!businessOk) { score -= 15; issues.push("Business name not mentioned in the post"); }
  if (!serviceOk) { score -= 12; issues.push("No verified service referenced"); }
  if (!locationOk) { score -= 12; issues.push("Target location not mentioned"); }
  if (!keywordOk) { score -= 12; issues.push("Primary keyword missing from the content"); }
  if (stuffing) { score -= 10; warnings.push(`Possible keyword stuffing (primary keyword used ${pkCount}x)`); }
  if (!ctaOk) { score -= 8; issues.push("Call to action is missing or unclear"); }
  if (!grammarOk) { score -= 8; warnings.push("AI reviewer flagged grammar issues"); }
  if (!lengthOk) { score -= 6; warnings.push("Description is shorter than 40 words"); }
  if (unsupported.length) { score -= Math.min(30, 15 * unsupported.length); issues.push(...unsupported.map((u) => `Unsupported claim - ${u}`)); }
  if (aiClaims.length) { score -= Math.min(8, 4 * aiClaims.length); warnings.push(...aiClaims.map((c) => `AI flagged wording: ${c}`)); }
  if (duplicateRisk) { score -= 15; issues.push(`Similar to a previous post (similarity ${(ctx.duplicateScore * 100).toFixed(0)}%)`); }
  if (policy.issues.length) { score -= Math.min(30, 15 * policy.issues.length); issues.push(...policy.issues); }
  if (policy.warnings.length) { score -= Math.min(9, 3 * policy.warnings.length); warnings.push(...policy.warnings); }
  if (ai.hook_ok === false) { score -= 3; warnings.push("Opening line is a weak hook - lead with the customer's situation"); }
  if (Array.isArray(ai.warnings)) warnings.push(...ai.warnings.filter(Boolean).map(String).slice(0, 3));

  score = Math.max(0, Math.min(100, score));
  const status = score >= QA_PASS_SCORE && issues.length === 0 ? "PASS" : "REVIEW";

  return {
    score,
    status,
    issues: issues.slice(0, 12),
    warnings: warnings.slice(0, 12),
    checks: {
      business_accuracy: businessOk,
      service_accuracy: serviceOk,
      keyword_relevance: keywordOk,
      location_relevance: locationOk,
      grammar: grammarOk,
      cta: ctaOk,
      keyword_stuffing: stuffing,
      duplicate_risk: duplicateRisk,
      unsupported_claims: unsupported.length > 0,
      keyword_coverage: pkCount > 0,
      google_policy: policy.issues.length === 0,
    },
    suggested_fix: String(ai.suggested_fix || "").slice(0, 300),
  };
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

