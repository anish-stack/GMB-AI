import { runAI, getProviderChain } from "../index.js";
import * as contentPrompt from "../prompts/content.js";
import { cleanPostText, fitText, fitPost, capsPlaces, normalizeCta, DESC_MIN_CHARS } from "../textPolicy.js";


/**
 * Models sometimes wrap the answer ({"post":{...}}, [{...}]) or rename keys
 * ("Title", "headline", "body"). Normalise so a valid answer is never lost.
 */
const ALIASES = {
  title: ["image_headline", "headline", "title", "post_title", "heading"],
  description: ["description", "body", "post_body", "content", "text", "summary", "post_description", "post"],
  primary_keyword: ["primary_keyword", "primarykeyword", "keyword", "main_keyword"],
  secondary_keywords: ["secondary_keywords", "secondarykeywords"],
  tertiary_keywords: ["tertiary_keywords", "tertiarykeywords", "long_tail_keywords"],
  cta: ["cta", "call_to_action", "button"],
  image_subtitle: ["image_subtitle", "subtitle"],
  image_concept: ["image_concept", "image_prompt", "image"],
  angle: ["angle"],
};

export function normalizeContent(raw) {
  let d = raw;
  if (Array.isArray(d)) d = d[0];
  if (!d || typeof d !== "object") return {};
  const lower = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase().replace(/[\s-]+/g, "_"), v]));
  let o = lower(d);
  const hasCore = (x) => ALIASES.title.some((k) => typeof x[k] === "string") || ALIASES.description.some((k) => typeof x[k] === "string");
  if (!hasCore(o)) {
    // unwrap one level: {"post": {...}} / {"result": {...}} / {"data": [{...}]}
    for (const v of Object.values(o)) {
      const inner = Array.isArray(v) ? v[0] : v;
      if (inner && typeof inner === "object" && hasCore(lower(inner))) {
        o = lower(inner);
        break;
      }
    }
  }
  const out = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    for (const n of names) {
      if (o[n] !== undefined && o[n] !== null && o[n] !== "") {
        out[key] = o[n];
        break;
      }
    }
  }
  if (Array.isArray(out.description)) out.description = out.description.join(" ");
  if (typeof out.description === "object") out.description = "";
  return out;
}

async function askModel(kb, input, ctx, extra = "", { exclude = [] } = {}) {
  const res = await runAI({
    agent: "content",
    system: contentPrompt.system,
    prompt: contentPrompt.build(kb, input) + extra,
    meta: {
      agent: "content",
      knowledge: kb,
      primaryKeyword: input.primaryKeyword,
      service: input.service,
      seed: ctx.seed,
    },
    taskId: ctx.taskId,
    clientId: kb.client_id,
    // up to 250 words of JSON + Gemini "thinking" tokens share this budget
    maxTokens: 4096,
    temperature: 0.75,
    exclude,
  });
  return { data: normalizeContent(res.data), raw: res.raw, provider: res.provider };
}

/**
 * Small local models (llama3.2 3B) often write 400-700 characters. Asking them to
 * EXPAND their own text works far better than asking for a whole new post.
 */
async function expandDescription(kb, input, data, ctx) {
  const kws = [input.primaryKeyword, ...(input.secondaryKeywords || [])].filter(Boolean).join(", ");
  const res = await runAI({
    agent: "content",
    system:
      "You expand Google Business Profile posts. Keep the facts, business name, places and keywords. " +
      "Write natural, specific, helpful text for local customers. Plain text paragraphs, no markdown, no hashtags, no emojis. " +
      'Answer ONLY with JSON: {"description": "..."}',
    prompt:
      `Business: ${kb.business} (${kb.category}) in ${kb.city}.\n` +
      `Services: ${(kb.services || []).slice(0, 8).join(", ")}.\n` +
      `Topic: ${input.topic}. Keywords to keep: ${kws || "-"}.\n\n` +
      `Current post (${String(data.description || "").length} characters - TOO SHORT):\n"""${data.description}"""\n\n` +
      `Rewrite and EXPAND it to ${DESC_MIN_CHARS + 50}-1450 characters (about 220-250 words) in 3-4 short paragraphs: ` +
      "1) the customer's problem, 2) how the business solves it (concrete details, process, what is included), " +
      "3) why choose them / local trust, 4) a clear call to action. Do not invent prices, awards or phone numbers.",
    meta: { agent: "content", knowledge: kb, seed: `${ctx.seed || ""}-expand` },
    taskId: ctx.taskId,
    clientId: kb.client_id,
    maxTokens: 2048,
    temperature: 0.7,
  });
  const d = normalizeContent(res.data);
  return d.description ? { ...data, description: d.description } : data;
}

export async function runContentAgent(kb, input, ctx = {}) {
  let { data, raw, provider } = await askModel(kb, input, ctx);
  const len = (d) => String(d?.description || "").length;

  if (len(data) < DESC_MIN_CHARS) {
    if (len(data) < 200) {
      // missing / almost empty -> one corrective full retry
      console.error(`[content] task ${ctx.taskId}: description missing/short (${len(data)} chars). Raw: ${String(raw || "").slice(0, 400)}`);
      const retry = await askModel(
        kb,
        input,
        { ...ctx, seed: `${ctx.seed || ""}-fix` },
        `\n\nIMPORTANT: your previous description was ${len(data)} characters. Return ONLY one flat JSON object with ALL the keys shown above. "description" MUST be ${DESC_MIN_CHARS}-1500 characters (about 220 words, 3-4 paragraphs).`,
      ).catch(() => null);
      if (retry && len(retry.data) > len(data)) ({ data, raw, provider } = retry);
    }
    // has text but too short -> expand it (same provider chain, Ollama first)
    if (len(data) >= 200 && len(data) < DESC_MIN_CHARS) {
      const expanded = await expandDescription(kb, input, data, ctx).catch(() => null);
      if (expanded && len(expanded) > len(data)) data = expanded;
    }
  }

  // Ollama still short -> one Gemini call for this post (OLLAMA_SHORT_FALLBACK=off to disable)
  const fallbackOn = String(process.env.OLLAMA_SHORT_FALLBACK || "gemini").toLowerCase() !== "off";
  if (
    fallbackOn &&
    provider === "ollama" &&
    len(data) < DESC_MIN_CHARS * 0.9 &&
    getProviderChain().some((p) => p.name !== "ollama" && p.name !== "mock")
  ) {
    const cloud = await askModel(kb, input, { ...ctx, seed: `${ctx.seed || ""}-cloud` }, "", { exclude: ["ollama", "mock"] }).catch(() => null);
    if (cloud && len(cloud.data) > len(data)) {
      // keep the Ollama keywords/CTA if the cloud answer lacks them
      data = { ...data, ...Object.fromEntries(Object.entries(cloud.data).filter(([, v]) => v !== undefined && v !== "")) };
    }
  }

  // AI text still missing -> template text, but the post is FLAGGED (QA issue) instead of silently passing
  const aiText = cleanPostText(clean(data?.description, 3000));
  const fallback = !aiText;
  const places = [kb.city, ...(kb.target_locations || [])];
  const { title, description: fitted } = fitPost(
    cleanPostText(clean(data?.title, 400)).replace(/[.!]+$/, "") || `${input.topic}`,
    fallback ? fallbackBody(kb, input) : aiText,
  );
  const description = capsPlaces(fitted, places);
  const kwList = (v, fallback) => (Array.isArray(v) ? v : fallback || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean).slice(0, 3);

  return {
    title,
    description,
    fallback,
    primary_keyword: String(data?.primary_keyword || input.primaryKeyword || "").toLowerCase(),
    secondary_keywords: kwList(data?.secondary_keywords, input.secondaryKeywords),
    tertiary_keywords: kwList(data?.tertiary_keywords, input.tertiaryKeywords),
    cta: normalizeCta(clean(data?.cta, 40) || input.cta),
    image_subtitle: fitText(clean(data?.image_subtitle, 120), 60),
    angle: clean(data?.angle, 200),
    image_concept:
      clean(data?.image_concept, 500) ||
      `Professional photo representing ${input.topic} at a ${kb.category} in ${kb.city}`,
  };
}

function clean(v, max) {
  if (!v) return "";
  return String(v).replace(/\s+\n/g, "\n").trim().slice(0, max);
}

function fallbackBody(kb, input) {
  const loc = kb.target_locations[0] || kb.city;
  const topic = String(input.topic || kb.category).replace(new RegExp(`\\s+in\\s+${String(loc).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "");
  const services = kb.services.slice(0, 3);
  return [
    `Looking for ${topic.toLowerCase()} in ${loc}?`,
    `${kb.business} helps customers across ${loc} with ${services.length > 1 ? `${services.slice(0, -1).join(", ")} and ${services.at(-1)}` : services[0] || kb.category.toLowerCase()}.`,
    kb.description ? String(kb.description).split(/(?<=[.!?])\s/).slice(0, 2).join(" ") : "",
    `Tell us what you need and we'll suggest the right option, share the process and timelines, and answer your questions before you decide.`,
    `Get in touch today to get started.`,
  ].filter(Boolean).join(" ");
}