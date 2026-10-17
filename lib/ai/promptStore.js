import { query } from "../db.js";

/**
 * Admin prompt overrides (table ai_prompts), cached for 30 s per process.
 * applyPromptOverrides() is called by runAI() for every agent request.
 */
let cache = null;
let loadedAt = 0;
const TTL = 30_000;

export async function promptOverrides({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - loadedAt < TTL) return cache;
  try {
    const rows = await query("SELECT pkey, content FROM ai_prompts");
    cache = Object.fromEntries(rows.map((r) => [r.pkey, String(r.content ?? "")]));
  } catch {
    cache = cache || {}; // table missing (migration not run yet) -> defaults
  }
  loadedAt = Date.now();
  return cache;
}

export function clearPromptCache() {
  cache = null;
  loadedAt = 0;
}

export async function savePromptOverride(key, content, actor) {
  await query(
    "INSERT INTO ai_prompts (pkey, content, updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE content=VALUES(content), updated_by=VALUES(updated_by)",
    [key, String(content), actor || null],
  );
  clearPromptCache();
}

export async function deletePromptOverride(key) {
  await query("DELETE FROM ai_prompts WHERE pkey=?", [key]);
  clearPromptCache();
}

/** -> { system, prompt } with the admin's overrides applied. */
export async function applyPromptOverrides(agent, system, prompt) {
  const o = await promptOverrides();
  if (!Object.keys(o).length) return { system, prompt };
  let sys = system;
  let p = String(prompt ?? "");
  if (agent && o[`${agent}.system`]?.trim()) sys = o[`${agent}.system`];
  const blocks = Object.keys(o).filter((k) => k.startsWith("guide.") || k === "content.voice");
  if (blocks.length) {
    const { entry } = await import("./promptRegistry.js");
    for (const k of blocks) {
      const def = entry(k)?.default;
      if (def && p.includes(def)) p = p.split(def).join(o[k]);
    }
  }
  if (agent && o[`${agent}.extra`]?.trim()) p += `\n\nADDITIONAL INSTRUCTIONS (follow these as well):\n${o[`${agent}.extra`].trim()}`;
  return { system: sys, prompt: p };
}
