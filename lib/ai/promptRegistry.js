/**
 * Every AI prompt the admin can edit (Admin -> AI prompts).
 *   system - replaces the agent's system prompt
 *   extra  - appended to the agent's request as "ADDITIONAL INSTRUCTIONS"
 *   block  - a shared rules block; replaced wherever it appears in any prompt
 * Defaults live in lib/ai/prompts/*; the DB (ai_prompts) only stores overrides.
 */
import * as content from "./prompts/content.js";
import * as keywords from "./prompts/keywords.js";
import * as topics from "./prompts/topics.js";
import * as research from "./prompts/research.js";
import * as qa from "./prompts/qa.js";
import * as reviewReply from "./prompts/reviewReply.js";
import * as humanize from "./prompts/humanize.js";
import { DM_SYSTEM, REVIEW_SUGGEST_SYSTEM } from "./prompts/misc.js";
import { GBP_RULES, WRITING_RULES, SEARCH_INTENT } from "./prompts/guide.js";

const AGENTS = [
  ["content", "Post writer", "Writes the Google post (description, image headline, CTA).", content.system],
  ["humanize", "Humanizer", "Rewrites posts that score as AI-written so they read human.", humanize.system],
  ["keywords", "Keyword research", "Picks primary / secondary / local keywords from the client facts.", keywords.system],
  ["topic", "Topic planner", "Chooses the topic for each scheduled post.", topics.system],
  ["research", "Local research", "Summarises who searches for the business and why.", research.system],
  ["qa", "Quality check", "Scores each post and flags unsupported claims.", qa.system],
  ["review_reply", "Review replies", "Drafts / auto-replies to Google reviews.", reviewReply.system],
  ["review_suggest", "Review QR assistant", "Writes 3 review drafts for customers in the QR flow.", REVIEW_SUGGEST_SYSTEM],
  ["dm_reply", "Instagram DM replies", "Auto-replies to Instagram DMs (test mode).", DM_SYSTEM],
];

export const PROMPT_ENTRIES = [
  ...AGENTS.flatMap(([agent, label, help, sys]) => [
    { key: `${agent}.system`, agent, group: label, kind: "system", label: "System prompt", help, default: sys },
    { key: `${agent}.extra`, agent, group: label, kind: "extra", label: "Extra instructions", help: "Added to the end of every request this agent sends (leave empty for none).", default: "" },
  ]),
  { key: "guide.gbp_rules", group: "Shared rules", kind: "block", label: "Google Business Profile rules", help: "Hard constraints given to every post-writing agent.", default: GBP_RULES },
  { key: "guide.writing_rules", group: "Shared rules", kind: "block", label: "Writing quality rules", help: "Voice and style rules shared by the writing agents.", default: WRITING_RULES },
  { key: "guide.search_intent", group: "Shared rules", kind: "block", label: "Search intent lenses", help: "Which search intent each post should serve.", default: SEARCH_INTENT },
  { key: "content.voice", group: "Post writer", kind: "block", label: "Voice & banned words", help: "Tone, sentence style and the list of banned words / phrases.", default: content.CONTENT_VOICE },
];

export const PROMPT_KEYS = new Set(PROMPT_ENTRIES.map((e) => e.key));
export const entry = (key) => PROMPT_ENTRIES.find((e) => e.key === key) || null;
