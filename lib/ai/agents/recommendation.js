import { runAI } from "../index.js";

export async function runRecommendationAgent(kb, stats, ctx = {}) {
  const prompt = `Business: ${kb.business} (${kb.category}, ${kb.city})
Services: ${kb.services.join(", ")}
Recent post titles: ${kb.previous_posts.map((p) => p.title).join(" | ") || "none"}
Stats: ${JSON.stringify(stats)}

Suggest 3-5 short, concrete GMB content actions for the next 30 days.
Use only verified services. Return JSON: { "recommendations": ["..."] }`;

  const { data } = await runAI({
    agent: "recommendation",
    system: "You are a local SEO strategist. Return a single valid JSON object and nothing else.",
    prompt,
    meta: { agent: "recommendation", knowledge: kb },
    clientId: kb.client_id,
    taskId: ctx.taskId || null,
    maxTokens: 400,
    temperature: 0.6,
  });

  const list = Array.isArray(data?.recommendations) ? data.recommendations.map(String) : [];
  return list.length
    ? list.slice(0, 5)
    : kb.services.slice(0, 3).map((s) => `Publish a post covering ${s} for ${kb.target_locations[0] || kb.city}`);
}
