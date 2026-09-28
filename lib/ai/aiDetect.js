import { CLICHES } from "./prompts/guide.js";

/**
 * AI-likelihood score (0 = reads human, 100 = reads machine-written).
 *
 * Heuristic detector tuned for SHORT local-business copy (title + <=250 chars),
 * where statistical detectors are unreliable. Signals:
 *   - generic "AI voice" phrases, marketing clichés
 *   - low burstiness (all sentences similar length)
 *   - no contractions, em-dash / triad-list habits, "Whether you're…" openers
 *   - lack of concrete detail (numbers, places, times)
 * Optional: blends in Sapling AI Detector when configured (Admin -> Integrations).
 * No detector is definitive - use the score as a guide, not proof.
 */
const AI_PHRASES = [
  ...CLICHES,
  "whether you're", "whether you are", "we understand", "rest assured", "don't hesitate", "do not hesitate",
  "your trusted", "trusted partner", "committed to", "dedicated to providing", "we pride ourselves", "tailored",
  "comprehensive", "robust", "empower", "ensure that", "navigate", "dive into", "in the realm", "take your",
  "to the next level", "look no further", "peace of mind", "experience the difference", "unparalleled",
  "exceptional", "high-quality", "top-quality", "best-in-class", "furthermore", "moreover", "additionally",
  "it's important to note", "when it comes to", "in conclusion", "a wide range of", "state of the art",
];

const CONTRACTION = /\b\w+'(s|re|ve|ll|d|t|m)\b/i;
const CONCRETE = /(\d|₹|\b(am|pm|mins?|minutes|hours|sector|road|nagar|marg|near|opposite|metro|mall|dr)\b)/i;

function sentences(text) {
  return String(text || "")
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3);
}

export function heuristicAiScore(title, description) {
  const text = `${title || ""}. ${description || ""}`;
  const lower = text.toLowerCase();
  const signals = [];
  let score = 18; // short promotional copy starts slightly "AI-ish"

  const hits = [...new Set(AI_PHRASES.filter((p) => lower.includes(p)))];
  if (hits.length) {
    score += Math.min(55, hits.length * 14);
    signals.push(`Generic AI phrases: ${hits.slice(0, 4).map((h) => `"${h}"`).join(", ")}`);
  }

  const ss = sentences(description);
  if (ss.length >= 3) {
    const lens = ss.map((s) => s.split(/\s+/).length);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
    const burst = sd / (mean || 1);
    if (burst < 0.25) {
      score += 14;
      signals.push("Sentences are all a similar length (low burstiness)");
    } else if (burst > 0.5) score -= 8;
  }
  if (!CONTRACTION.test(text) && String(description).length > 120) {
    score += 8;
    signals.push("No contractions (reads formal / machine-like)");
  } else if (CONTRACTION.test(text)) score -= 6;
  const dashes = (text.match(/—/g) || []).length;
  if (dashes >= 1) {
    score += 6 * dashes;
    signals.push("Em-dash usage typical of AI text");
  }
  if (/\b\w+, \w+(?: \w+)?, and \w+/i.test(text)) {
    score += 6;
    signals.push('"X, Y, and Z" triad list');
  }
  if (/^(whether|from|with|in today|at \w+,)/i.test(ss[0] || "")) {
    score += 8;
    signals.push("Formulaic opening");
  }
  if ((text.match(/!/g) || []).length >= 2) {
    score += 5;
    signals.push("Multiple exclamation marks");
  }
  if (CONCRETE.test(text)) score -= 10;
  else {
    score += 6;
    signals.push("No concrete detail (numbers, times, landmarks)");
  }
  if (/\?/.test(ss[0] || "")) score -= 4; // question hooks read conversational

  return { score: Math.max(2, Math.min(98, Math.round(score))), signals };
}

async function saplingScore(text) {
  try {
    const { getIntegration } = await import("../integrations/store.js");
    const i = await getIntegration("ai_detector");
    if (!i?.enabled || !i.values.api_key) return null;
    const res = await fetch("https://api.sapling.ai/api/v1/aidetect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: i.values.api_key, text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.score === "number" ? Math.round(j.score * 100) : null;
  } catch {
    return null;
  }
}

/** { score, human, signals, source } - external detector blended in when configured. */
export async function detectAi(title, description) {
  const h = heuristicAiScore(title, description);
  const ext = await saplingScore(`${title}\n${description}`);
  const score = ext == null ? h.score : Math.round(ext * 0.7 + h.score * 0.3);
  return { score, human: 100 - score, signals: h.signals, source: ext == null ? "heuristic" : "sapling+heuristic" };
}
