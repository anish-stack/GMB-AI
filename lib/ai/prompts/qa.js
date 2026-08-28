import { knowledgeBlock } from "../../repo/knowledge.js";

export const system =
  "You are a strict content QA reviewer for local business posts. " +
  "You verify factual accuracy against verified client data and flag any unsupported claim. " +
  "Respond with a single valid JSON object and nothing else.";

export function build(kb, post) {
  return `${knowledgeBlock(kb)}

POST UNDER REVIEW
Title: ${post.title}
Description: ${post.description}
Primary keyword: ${post.primary_keyword}
CTA: ${post.cta}

Check: business accuracy, service accuracy, location relevance, keyword usage (natural, not stuffed),
grammar and readability, clear CTA, and any unsupported claim (price, offer, award, certification,
guarantee, medical promise, superlative like "best/No.1" without proof).

Return JSON exactly in this shape:
{
  "grammar_ok": true,
  "tone_ok": true,
  "readability": "GOOD|AVERAGE|POOR",
  "unsupported_claims": ["exact phrases, empty array if none"],
  "issues": ["blocking problems"],
  "warnings": ["non-blocking notes"],
  "suggested_fix": "one sentence or empty string"
}`;
}
