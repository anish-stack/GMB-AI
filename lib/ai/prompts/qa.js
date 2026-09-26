import { knowledgeBlock } from "../../repo/knowledge.js";
import { CLICHES } from "./guide.js";

export const system =
  "You are a strict content QA reviewer for Google Business Profile posts. " +
  "You compare every sentence against the verified client data and Google's post policy, and you flag anything unsupported. " +
  "You are specific: quote the exact phrase. Respond with a single valid JSON object and nothing else.";

export function build(kb, post) {
  return `${knowledgeBlock(kb)}

POST UNDER REVIEW
Title: ${post.title}
Description: ${post.description}
Primary keyword: ${post.primary_keyword}
CTA: ${post.cta}

Check, sentence by sentence:
1. Every fact about the business/services is in the verified data.
2. Unsupported claims: price, offer, award, certification, guarantee, medical promise, experience years, superlatives ("best", "No.1") without approval.
3. Policy: phone numbers, URLs, emails, ALL-CAPS, >1 emoji, hashtags in body.
4. Keyword used naturally (not stuffed), location mentioned naturally.
5. Grammar, readability, and a clear CTA.
6. Generic AI clichés (e.g. ${CLICHES.slice(0, 8).join(", ")}).
7. Does the first sentence work as a hook on its own?

Return JSON exactly in this shape:
{
  "grammar_ok": true,
  "tone_ok": true,
  "hook_ok": true,
  "readability": "GOOD|AVERAGE|POOR",
  "unsupported_claims": ["exact phrases, empty array if none"],
  "issues": ["blocking problems, quote the phrase"],
  "warnings": ["non-blocking notes"],
  "suggested_fix": "one concrete rewrite instruction, or empty string"
}`;
}
