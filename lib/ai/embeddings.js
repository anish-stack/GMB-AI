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

/** Word 4-gram shingles - catches real copy-paste, unlike embeddings which see "same topic". */
function shingles(text) {
  const w = String(text || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i + 4 <= w.length; i++) out.add(w.slice(i, i + 4).join(" "));
  return out;
}

export function textOverlap(a, b) {
  const A = shingles(a);
  const B = shingles(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.min(A.size, B.size);
}

/**
 * Compare a freshly generated post against the client's previous posts.
 *
 * Posts of ONE business always share services / city / brand, so embeddings
 * alone flag almost everything (~0.86-0.92). A post is a duplicate only when:
 *   - meaning is near-identical (cosine >= 0.95), or
 *   - meaning is close (>= DUPLICATE_THRESHOLD) AND the wording overlaps (>= 30% shared 4-word phrases).
 * Rejected / failed drafts are ignored.
 * @returns {{score:number, duplicate:boolean, matchTaskId:number|null, vector:number[], overlap:number}}
 */
export async function checkDuplicate({ clientId, taskId, title, description }) {
  const text = `${title}\n${description}`;
  const vector = await embed(text, { taskId, clientId });

  const previous = await query(
    `SELECT id, title, description, embedding FROM ai_tasks
      WHERE client_id=? AND id<>? AND embedding IS NOT NULL AND status NOT IN ('REJECTED','FAILED')
      ORDER BY id DESC LIMIT 30`,
    [clientId, taskId || 0]
  );

  let best = { score: 0, overlap: 0, id: null, dup: false };
  for (const row of previous) {
    const vec = parseJson(row.embedding);
    if (!Array.isArray(vec)) continue;
    const score = cosine(vector, vec);
    if (score < DUPLICATE_THRESHOLD - 0.05 && score <= best.score) continue;
    const overlap = textOverlap(description, row.description);
    const dup = score >= 0.95 || (score >= DUPLICATE_THRESHOLD && overlap >= 0.3);
    if ((dup && !best.dup) || (dup === best.dup && score > best.score)) best = { score, overlap, id: row.id, dup };
  }
  return {
    score: Number(best.score.toFixed(4)),
    overlap: Number(best.overlap.toFixed(3)),
    duplicate: best.dup,
    matchTaskId: best.dup ? best.id : null,
    vector,
  };
}
