import { runAI } from "../index.js";
import * as reviewReplyPrompt from "../prompts/reviewReply.js";

const TONES = ["professional", "friendly", "short", "apologetic", "grateful"];

/**
 * Generates a draft review reply.
 * Never publishes - caller must call provider.replyToReview()
 * explicitly after the user approves the draft.
 */
export async function runReviewReplyAgent(
  { business, category, rating, comment },
  tone = "professional",
  ctx = {},
) {
  const safeTone = TONES.includes(tone) ? tone : "professional";

  const basePrompt = reviewReplyPrompt.build(
    { business, category, rating, comment },
    safeTone,
  );

  const lengthRule =
    safeTone === "short"
      ? "Write approximately 20 to 35 words."
      : "Write approximately 40 to 80 words in 2 to 4 complete sentences.";

  const prompt = `${basePrompt}

Additional reply requirements:
- ${lengthRule}
- Sound natural, human, and professional.
- Do not return an extremely short reply like "Thank you!".
- Thank the customer naturally where appropriate.
- Refer to specific feedback from the review when possible.
- Do not repeat the customer's review word-for-word.
- Do not overuse the business name.
- Do not mention AI, automation, or generated content.
- Do not invent facts, offers, discounts, promises, or services.
- If the review is negative, acknowledge the concern calmly and respectfully.
- If the review is positive, show appreciation and reference the positive experience.
- If there is no written comment, respond only based on the rating without inventing details.
- Return valid JSON only in this format: {"reply":"your generated reply here"}`;

  console.log("[REVIEW_REPLY] Input", {
    business,
    category,
    rating,
    tone: safeTone,
    comment,
  });

  console.log("[REVIEW_REPLY] Prompt:", prompt);

  const { data, raw, provider, model } = await runAI({
    agent: "review_reply",
    system: reviewReplyPrompt.system,
    prompt,
    meta: {
      agent: "review_reply",
      tone: safeTone,
    },
    taskId: ctx.taskId || null,
    clientId: ctx.clientId,
    maxTokens: 320,
    temperature: 0.7,
    json: true,
  });

  console.log("[REVIEW_REPLY] Raw AI output:", raw);
  console.log("[REVIEW_REPLY] Parsed AI data:", data);
  console.log("[REVIEW_REPLY] AI meta", {
    provider,
    model,
  });

let reply = String(data?.reply || "").trim();

if (!reply) {
  console.error("[REVIEW_REPLY] Invalid/truncated AI response", {
    raw,
    data,
    provider,
    model,
  });

  throw new Error(
    "AI returned an incomplete review reply. Please regenerate.",
  );
}

  // Remove wrapping quotes and clean excessive whitespace.
  reply = reply
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = reply.split(/\s+/).filter(Boolean).length;

  if (safeTone !== "short" && wordCount < 20) {
    console.warn("[REVIEW_REPLY] Reply too short", {
      wordCount,
      reply,
    });
  }

  console.log("[REVIEW_REPLY] Final draft", {
    wordCount,
    length: reply.length,
    reply,
  });

  return {
    reply: reply.slice(0, 4096),
    tone: safeTone,
    provider,
    model,
  };
}