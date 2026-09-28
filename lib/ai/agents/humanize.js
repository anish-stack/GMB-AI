import { runAI } from "../index.js";
import { cleanPostText, fitPost, capsPlaces, DESC_MIN_CHARS, DESC_MAX_CHARS } from "../textPolicy.js";
import { detectAi } from "../aiDetect.js";

const system =
  "You rewrite Google Business Profile posts so they read like the business owner wrote them - natural, specific, human. " +
  "You keep every fact and keyword, and respond with a single valid JSON object only.";

function prompt(kb, post, signals) {
  return `Business: ${kb.business} (${kb.category}) in ${kb.city}
Verified services: ${(kb.services || []).slice(0, 10).join(", ")}
Language: ${kb.language}. Tone: ${kb.tone}.

ORIGINAL
Title: ${post.title}
Description: ${post.description}
Keywords that MUST stay (exact words): ${[post.primary_keyword, ...(post.secondary_keywords || []), ...(post.tertiary_keywords || [])].filter(Boolean).join(" | ")}

Why it reads machine-written: ${signals.join("; ") || "generic marketing voice"}

REWRITE RULES
- Sound like a local owner talking to a neighbour: plain words, one concrete detail (a time, a step, a local reference) from the verified facts only.
- Mix one short sentence with longer ones. Use a contraction or two (we're, you'll, it's).
- Remove every generic phrase (e.g. "look no further", "top-notch", "whether you're", "we pride ourselves", "comprehensive", "seamless", "rest assured").
- No em-dashes, no hashtags, no emojis, no exclamation marks, no phone numbers or URLs.
- Do not invent prices, offers, awards, years or guarantees.
- description ${DESC_MIN_CHARS}-${DESC_MAX_CHARS} characters, 3-4 short paragraphs, city / area names in CAPITALS, no hashtags.
- "title" is the short image headline (4-8 words) - keep it short.

Return JSON: { "title": "", "description": "" }`;
}

/** Rewrites until the AI score is under `target` (max `attempts`); returns the best version. */
export async function humanizePost(kb, post, { ctx = {}, target = 35, attempts = 2 } = {}) {
  const first = await detectAi(post.title, post.description);
  let best = { title: post.title, description: post.description, ...first };
  const original = first.score;
  for (let i = 0; i < attempts && best.score > target; i++) {
    try {
      const { data } = await runAI({
        agent: "humanize",
        system,
        prompt: prompt(kb, { ...post, title: best.title, description: best.description }, best.signals),
        meta: { agent: "humanize", original: { title: best.title, description: best.description }, seed: `${ctx.seed || ""}-h${i}` },
        taskId: ctx.taskId,
        clientId: kb.client_id,
        maxTokens: 4096,
        temperature: 0.9,
      });
      const fitted = fitPost(
        cleanPostText(String(data?.title || data?.image_headline || post.title || "")).replace(/[.!]+$/, ""),
        cleanPostText(String(data?.description || "")).replace(/—/g, ", "),
      );
      const title = fitted.title || post.title;
      const description = capsPlaces(fitted.description, [kb.city, ...(kb.target_locations || [])]);
      // never accept a rewrite that makes the post much shorter than the minimum
      if (description.length < Math.min(DESC_MIN_CHARS, String(post.description || "").length) * 0.9) continue;
      // keyword words that were in the text before must still be there after
      const before = `${post.title} ${post.description}`.toLowerCase();
      const kw = String(post.primary_keyword || "").toLowerCase().split(/\s+/).filter((w) => w.length > 3 && before.includes(w));
      const keepsKeyword = !kw.length || kw.every((w) => `${title} ${description}`.toLowerCase().includes(w));
      if (!keepsKeyword) continue;
      const d = await detectAi(title, description);
      if (d.score < best.score) best = { title, description, ...d };
    } catch {
      /* keep the best so far */
    }
  }
  return { title: best.title, description: best.description, ai_score: best.score, ai_score_original: original, humanized: best.score < original, signals: best.signals, source: best.source };
}