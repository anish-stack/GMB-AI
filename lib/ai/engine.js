import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Which AI writes the TEXT of a post run.
 *   ollama  - every agent on Ollama (free; Gemini only if Ollama is down)
 *   gemini  - every agent on Gemini (fast)
 *   hybrid  - post text (content + humanize, HYBRID_GEMINI_AGENTS) on Gemini,
 *             research / keywords / topic / QA / embeddings on Ollama
 *   - background (nightly job, calendar auto-post, auto-schedule): AI_BACKGROUND_ENGINE (default hybrid)
 *   - manual (Generate AI, Regenerate, Run AI job button): the user picks.
 * Images always use Gemini (IMAGE_PROVIDER) - not affected.
 */
const als = new AsyncLocalStorage();
export const ENGINES = ["ollama", "gemini", "hybrid"];

/** hybrid: these agents (the post text) go to Gemini, everything else stays on Ollama. */
const hybridGeminiAgents = () =>
  String(process.env.HYBRID_GEMINI_AGENTS || "content,humanize")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

export function normalizeEngine(v) {
  const e = String(v || "").trim().toLowerCase();
  return ENGINES.includes(e) ? e : null;
}

/** Runs fn with the engine for every runAI / embed call inside it (also across awaits). */
export function withEngine(engine, fn) {
  const e = normalizeEngine(engine);
  return e ? als.run({ engine: e }, fn) : fn();
}

/** Engine of this run; background runs (no choice made) use AI_BACKGROUND_ENGINE (default hybrid). */
export function currentEngine() {
  return als.getStore()?.engine || normalizeEngine(process.env.AI_BACKGROUND_ENGINE) || "hybrid";
}

/**
 * Provider this agent should try FIRST under the current engine (null = normal order).
 * It is an order, not a filter: if Gemini fails, Ollama still gets a go before the
 * offline template (Mock) - a failed Gemini call must never turn into template text.
 */
export function enginePreferred(agent = "") {
  const e = currentEngine();
  if (e === "gemini") return "gemini";
  if (e === "hybrid" && hybridGeminiAgents().includes(String(agent).toLowerCase())) return "gemini";
  return null;
}

/** Kept for callers that still import it - nothing is excluded any more. */
export function engineExclusions() {
  return [];
}
