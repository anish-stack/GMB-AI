import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Which AI writes the TEXT of a post run.
 *   - background (nightly job, calendar auto-post, auto-schedule): no engine set ->
 *     default chain, Ollama first (free), Gemini if Ollama is down.
 *   - manual (Generate AI, Regenerate, Run AI job button): the user picks
 *     "ollama" or "gemini"; the choice applies to every agent of that run.
 * Images always use Gemini (IMAGE_PROVIDER) - not affected.
 */
const als = new AsyncLocalStorage();
export const ENGINES = ["ollama", "gemini"];

export function normalizeEngine(v) {
  const e = String(v || "").trim().toLowerCase();
  return ENGINES.includes(e) ? e : null;
}

/** Runs fn with the engine for every runAI / embed call inside it (also across awaits). */
export function withEngine(engine, fn) {
  const e = normalizeEngine(engine);
  return e ? als.run({ engine: e }, fn) : fn();
}

export function currentEngine() {
  return als.getStore()?.engine || null;
}

/** Providers runAI must skip for the current engine. */
export function engineExclusions() {
  return currentEngine() === "gemini" ? ["ollama"] : [];
}
