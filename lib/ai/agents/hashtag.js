import { runAI } from "../index.js";
import * as hashtagPrompt from "../prompts/hashtags.js";

export async function runHashtagAgent(kb, input, ctx = {}) {
  const { data } = await runAI({
    agent: "hashtags",
    system: hashtagPrompt.system,
    prompt: hashtagPrompt.build(kb, input),
    meta: { agent: "hashtags", knowledge: kb, seed: ctx.seed },
    taskId: ctx.taskId,
    clientId: kb.client_id,
    maxTokens: 120,
    temperature: 0.6,
  });

  let tags = Array.isArray(data?.hashtags) ? data.hashtags : [];
  tags = tags
    .map((t) => "#" + String(t).replace(/[^a-zA-Z0-9]/g, ""))
    .filter((t) => t.length > 2)
    .slice(0, 7);

  if (!tags.length) {
    const base = [kb.services[0], kb.category, kb.target_locations[0] || kb.city, kb.business];
    tags = base
      .filter(Boolean)
      .map((t) => "#" + String(t).replace(/[^a-zA-Z0-9]/g, ""))
      .concat("#LocalBusiness");
  }
  return [...new Set(tags)];
}
