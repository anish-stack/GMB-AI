import { runAI } from "../index.js";
import * as researchPrompt from "../prompts/research.js";

export async function runResearchAgent(kb, ctx = {}) {
  const { data } = await runAI({
    agent: "research",
    system: researchPrompt.system,
    prompt: researchPrompt.build(kb),
    meta: { agent: "research", knowledge: kb, seed: ctx.seed },
    taskId: ctx.taskId,
    clientId: kb.client_id,
    maxTokens: 520,
    temperature: 0.4,
  });

  return {
    summary: data?.summary || `${kb.business} is a ${kb.category} in ${kb.location}.`,
    audience: data?.audience || `Local customers in ${kb.target_locations.join(", ") || kb.city}.`,
    differentiators: arr(data?.differentiators, kb.services.slice(0, 3)),
    customer_questions: arr(data?.customer_questions, []),
    local_context: data?.local_context || `Serves ${kb.target_locations.join(", ") || kb.city}.`,
    content_opportunities: arr(data?.content_opportunities, kb.services.slice(0, 4)),
    verified_facts: {
      business: kb.business,
      category: kb.category,
      phone: kb.phone,
      website: kb.website,
      services: kb.services,
    },
  };
}

function arr(v, fallback) {
  return Array.isArray(v) && v.length ? v.map(String).slice(0, 6) : fallback;
}
