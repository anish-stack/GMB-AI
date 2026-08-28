import { embed } from "./index.js";
import { query, parseJson } from "../db.js";
import { DUPLICATE_THRESHOLD } from "../constants.js";

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Compare a freshly generated post against the client's previous posts.
 * @returns {{score:number, duplicate:boolean, matchTaskId:number|null, vector:number[]}}
 */
export async function checkDuplicate({ clientId, taskId, title, description }) {
  const text = `${title}\n${description}`;
  const vector = await embed(text, { taskId, clientId });

  const previous = await query(
    `SELECT id, title, embedding FROM ai_tasks
      WHERE client_id=? AND id<>? AND embedding IS NOT NULL
      ORDER BY id DESC LIMIT 40`,
    [clientId, taskId || 0]
  );

  let best = 0;
  let matchTaskId = null;
  for (const row of previous) {
    const vec = parseJson(row.embedding);
    if (!Array.isArray(vec)) continue;
    const score = cosine(vector, vec);
    if (score > best) {
      best = score;
      matchTaskId = row.id;
    }
  }
  return {
    score: Number(best.toFixed(4)),
    duplicate: best >= DUPLICATE_THRESHOLD,
    matchTaskId: best >= DUPLICATE_THRESHOLD ? matchTaskId : null,
    vector,
  };
}
