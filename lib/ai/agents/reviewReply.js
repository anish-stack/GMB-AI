import { runAI } from "../index.js";
import * as reviewReplyPrompt from "../prompts/reviewReply.js";

const TONES = ["professional", "friendly", "short", "apologetic", "grateful"];

/**
 * Drafts a review reply. Never publishes - the caller publishes only
 * after a human approves the draft.
 */
export async function runReviewReplyAgent(input, tone = "professional", ctx = {}) {
  const safeTone = TONES.includes(tone) ? tone : "professional";
  const lengthRule =
    safeTone === "short"
      ? "Length: 15-35 words."
      : Number(input.rating) <= 2
        ? "Length: 50-90 words, 3-4 sentences."
        : "Length: 30-70 words, 2-4 sentences.";

  const prompt = `${reviewReplyPrompt.build(input, safeTone)}\n${lengthRule}`;

  const { data, raw } = await runAI({
    agent: "review_reply",
    system: reviewReplyPrompt.system,
    prompt,
    meta: { agent: "review_reply", tone: safeTone },
    taskId: ctx.taskId || null,
    clientId: ctx.clientId,
    maxTokens: 360,
    temperature: 0.6,
    json: true,
  });

  // Some models ignore JSON mode - fall back to the raw text if it looks like a reply.
  let reply = String(data?.reply || "").trim();
  if (!reply && raw && !String(raw).trim().startsWith("{")) reply = String(raw).trim();
  if (!reply) throw new Error("AI returned an incomplete review reply. Please regenerate.");

  reply = reply
    .replace(/^["'“]|["'”]$/g, "")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4096);

  return { reply, tone: safeTone };
}
