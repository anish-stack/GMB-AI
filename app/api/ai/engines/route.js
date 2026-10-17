import { route } from "@/lib/saas/routeKit.js";
import { getProviderChain } from "@/lib/ai/index.js";
import { normalizeEngine } from "@/lib/ai/engine.js";

export const dynamic = "force-dynamic";

/** Engines a user can pick for a manual run (Generate AI / Regenerate / Run AI job). */
export const GET = route({ permission: "task.generate" }, async () => {
  const chain = getProviderChain();
  const ollama = chain.find((p) => p.name === "ollama");
  const gemini = chain.find((p) => p.name === "gemini");
  return {
    ollama: ollama ? { enabled: true, up: await ollama.available(), model: ollama.textModel } : { enabled: false, up: false, model: null },
    gemini: gemini ? { configured: true, model: gemini.textModel } : { configured: false, model: null },
    background: normalizeEngine(process.env.AI_BACKGROUND_ENGINE) || "hybrid",
  };
});
