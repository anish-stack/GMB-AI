import { system } from "../prompts/humanize.js";
import { runAI } from "../index.js";
import {
  cleanPostText,
  fitPost,
  capsPlaces,
  DESC_MIN_CHARS,
  DESC_MAX_CHARS,
  formatPlaces,
} from "../textPolicy.js";
import { detectAi } from "../aiDetect.js";
// Adjust this path to wherever guide.js lives in your repo.
import { BANNED_WORDS, STOCK_PHRASES } from "../prompts/guide.js";


// Forces Gemini JSON mode to return exactly these two string fields.
const HUMANIZE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    description: { type: "STRING" },
  },
  required: ["title", "description"],
};

const lc = (s) => String(s || "").toLowerCase();

/** First two sentences of a text, lowercased. */
function firstTwoSentences(text) {
  return lc(
    String(text || "")
      .split(/(?<=[.!?])\s+/)
      .slice(0, 2)
      .join(" "),
  );
}

function prompt(
  kb,
  post,
  signals,
  keywords,
  { force = false, keepTitle = false } = {},
) {
  return `Business: ${kb.business} (${kb.category}) in ${kb.city}
Verified services: ${(kb.services || []).slice(0, 10).join(", ")}
Language: ${kb.language}. Tone: ${kb.tone}.

ORIGINAL
Title: ${post.title}
Description: ${post.description}

MUST STAY (exact words, same spelling)
- Business name: ${kb.business}
- Keywords: ${keywords.join(" | ") || "none"}
- The primary keyword stays inside the first two sentences.

${
  force && !signals.length
    ? "The user asked for a fresh rewrite. Change the wording and sentence structure. Keep every fact."
    : `Why it reads machine-written: ${signals.join("; ") || "generic marketing voice"}`
}

REWRITE RULES
- Sound like a local owner talking to a neighbour: plain words, one concrete detail (a time, a step, a local reference) from the verified facts only.
- Mix very short sentences (3-6 words) with longer ones. Vary how sentences start. Do not make the paragraphs equal in length.
- Use a contraction or two (we're, you'll, it's).
- Open with a specific situation or a blunt fact. Not with a generic scene-setter.
- Remove every generic phrase. Banned words: ${BANNED_WORDS.join(", ")}. Banned phrases: ${STOCK_PHRASES.join(", ")}, "rest assured".
- No "not just X, but Y" constructions. No lists of three adjectives.
- No em-dashes, no hashtags, no emojis, no exclamation marks, no phone numbers, no URLs.
- Do not invent prices, offers, awards, years, guarantees or customer stories.
- description: ${DESC_MIN_CHARS}-${DESC_MAX_CHARS} characters, 3-4 paragraphs separated by a blank line, city and area names in normal capitalisation (Delhi, Sector 99A), never ALL CAPS..
- ${keepTitle ? `title: return exactly "${post.title}" unchanged.` : "title: short image headline, 4-8 words."}

Return JSON: { "title": "", "description": "" }`;
}

/** True when a rewrite still carries everything the original carried. */
function keepsRequired(kb, post, title, description) {
  const before = lc(`${post.title} ${post.description}`);
  const after = lc(`${title} ${description}`);

  // business name: if the original said it, the rewrite must too
  const biz = lc(kb.business);
  if (biz && before.includes(biz) && !after.includes(biz)) return false;

  // every keyword phrase that was in the original must still be there
  const phrases = [
    post.primary_keyword,
    ...(post.secondary_keywords || []),
    ...(post.tertiary_keywords || []),
  ]
    .map(lc)
    .filter(Boolean);
  for (const p of phrases) {
    if (before.includes(p) && !after.includes(p)) return false;
  }

  // primary keyword in the first two sentences, if it was there before
  const primary = lc(post.primary_keyword);
  if (primary && firstTwoSentences(post.description).includes(primary)) {
    if (!firstTwoSentences(description).includes(primary)) return false;
  }
  return true;
}

/**
 * Rewrites until the AI score is under `target` (max `attempts`); returns the best version.
 * force: rewrite even when the score is already under target (manual button).
 * keepTitle: leave the image headline alone, rewrite only the description.
 */
export async function humanizePost(
  kb,
  post,
  {
    ctx = {},
    target = 35,
    attempts = 2,
    force = false,
    keepTitle = false,
  } = {},
) {
  const first = await detectAi(post.title, post.description);
  let best = { title: post.title, description: post.description, ...first };
  const original = first.score;
  let changed = false;
  const keywords = [
    post.primary_keyword,
    ...(post.secondary_keywords || []),
    ...(post.tertiary_keywords || []),
  ].filter(Boolean);

  const shouldRun = (i) =>
    i < attempts && (force ? !changed : best.score > target);

  for (let i = 0; shouldRun(i); i++) {
    try {
      const { data } = await runAI({
        agent: "humanize",
        system,
        prompt: prompt(
          kb,
          { ...post, title: best.title, description: best.description },
          best.signals || [],
          keywords,
          { force, keepTitle },
        ),
        meta: {
          agent: "humanize",
          original: { title: best.title, description: best.description },
          seed: `${ctx.seed || ""}-h${i}`,
        },
        taskId: ctx.taskId,
        clientId: kb.client_id,
        maxTokens: 4096,
        temperature: 0.85,
        schema: HUMANIZE_SCHEMA,
      });

      const fitted = fitPost(
        keepTitle
          ? post.title
          : cleanPostText(
              String(data?.title || data?.image_headline || post.title || ""),
            ).replace(/[.!]+$/, ""),
        cleanPostText(String(data?.description || "")).replace(/—/g, ", "),
      );
      const title = keepTitle ? post.title : fitted.title || post.title;
      const description = formatPlaces(fitted.description, [
        kb.city,
        ...(kb.target_locations || []),
      ]);

      // never let a rewrite shorten the post: a full-length post must stay >= DESC_MIN_CHARS,
      // a short one must not lose more than 5%
      const origLen = String(post.description || "").length;
      const minLen = origLen >= DESC_MIN_CHARS ? DESC_MIN_CHARS : Math.floor(origLen * 0.95);
      if (description.length < minLen) continue;
      if (!keepsRequired(kb, post, title, description)) continue;
      if (description.trim() === String(best.description).trim()) continue;

      const d = await detectAi(title, description);
      const better = d.score < best.score;
      // manual click: accept any valid rewrite that stays under target
      const acceptable = force && d.score <= target;
      if (better || acceptable) {
        best = { title, description, ...d };
        changed = true;
      }
    } catch {
      /* keep the best so far */
    }
  }

  return {
    title: best.title,
    description: best.description,
    ai_score: best.score,
    ai_score_original: original,
    humanized: changed || best.score < original,
    changed,
    signals: best.signals,
    source: best.source,
  };
}
