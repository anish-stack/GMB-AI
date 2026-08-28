import { runAI } from "../index.js";
import * as contentPrompt from "../prompts/content.js";

export async function runContentAgent(kb, input, ctx = {}) {
  const { data } = await runAI({
    agent: "content",
    system: contentPrompt.system,
    prompt: contentPrompt.build(kb, input),
    meta: {
      agent: "content",
      knowledge: kb,
      primaryKeyword: input.primaryKeyword,
      service: input.service,
      seed: ctx.seed,
    },
    taskId: ctx.taskId,
    clientId: kb.client_id,
    maxTokens: 520,
    temperature: 0.85,
  });

  const title = clean(data?.title, 250) || `${input.topic}`;
  const description = clean(data?.description, 1400) || fallbackBody(kb, input);

  return {
    title,
    description,
    primary_keyword: String(data?.primary_keyword || input.primaryKeyword || "").toLowerCase(),
    secondary_keywords: Array.isArray(data?.secondary_keywords)
      ? data.secondary_keywords.map((s) => String(s).toLowerCase()).slice(0, 5)
      : (input.secondaryKeywords || []).slice(0, 5),
    cta: clean(data?.cta, 100) || input.cta || "Contact us today",
    image_concept:
      clean(data?.image_concept, 500) ||
      `Professional photo representing ${input.topic} at a ${kb.category} in ${kb.city}`,
  };
}

function clean(v, max) {
  if (!v) return "";
  return String(v).replace(/\s+\n/g, "\n").trim().slice(0, max);
}

function fallbackBody(kb, input) {
  const loc = kb.target_locations[0] || kb.city;
  return (
    `Looking for ${String(input.topic).toLowerCase()} in ${loc}? ${kb.business} provides ` +
    `${kb.services.slice(0, 3).join(", ")} with an experienced team and clear guidance at every step.\n\n` +
    `${input.cta || "Contact us today"} to know more.`
  );
}
