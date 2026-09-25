import { runAI } from "../index.js";
import * as topicPrompt from "../prompts/topics.js";

export async function runTopicAgent(kb, { keywords, postType, presetTopic }, ctx = {}) {
  const flat = [
    ...(keywords.primary_keywords || []),
    ...(keywords.secondary_keywords || []),
    ...(keywords.long_tail_keywords || []),
    ...(keywords.location_keywords || []),
  ];

  if (presetTopic) {
    return {
      topic: presetTopic,
      reason: "Topic was pre-scheduled by the admin in the content calendar.",
      priority: "High",
      target_keyword: bestKeywordFor(presetTopic, flat, kb),
      post_type: postType,
      alternatives: [],
      source: "CALENDAR",
    };
  }

  const { data } = await runAI({
    agent: "topic",
    system: topicPrompt.system,
    prompt: topicPrompt.build(kb, { keywords: flat.map((k) => k.keyword), postType }),
    meta: { agent: "topic", knowledge: kb, postType, seed: ctx.seed },
    taskId: ctx.taskId,
    clientId: kb.client_id,
    maxTokens: 260,
    temperature: 0.8,
  });

  const recentRaw = (kb.recent_topics || []).map((t) => String(t).toLowerCase());
  const recent = new Set(recentRaw);
  const recentNorm = new Set(recentRaw.map(normalize));
  let topic = String(data?.topic || "").trim();
  const alternatives = Array.isArray(data?.alternatives) ? data.alternatives.map(String) : [];

  // Avoid repeating a recently used topic - exact match AND a normalized/fuzzy
  // match (same words, different punctuation/casing/ordering), since the AI
  // often rewords the same topic just enough to dodge a plain string check.
  const isRepeat = (t) => !t || recent.has(t.toLowerCase()) || recentNorm.has(normalize(t));
  if (isRepeat(topic)) {
    const alt = alternatives.find((a) => !isRepeat(a));
    topic = alt || rotateService(kb, recentNorm);
  }

  return {
    topic,
    reason: data?.reason || `Covers a verified service that has not been posted recently.`,
    priority: data?.priority || "Medium",
    target_keyword: bestKeywordFor(topic, flat, kb),
    post_type: postType,
    alternatives: alternatives.slice(0, 3),
    source: "AI",
  };
}

/** Strips punctuation/extra spaces so "SEO in Delhi" and "SEO in Delhi!" (or a
 * reordered/paraphrased AI rewrite carrying the same words) count as the same topic. */
function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function rotateService(kb, recentNorm) {
  // BUG FIX: this used to compare a bare service name ("SEO") against full
  // recent topic strings ("Search Engine Optimization (SEO) in Delhi"), which
  // never matched - so every fallback silently returned kb.services[0] again,
  // which is exactly the duplicate-topic bug. Now it checks whether the
  // service actually shows up (as a word set) inside any recent topic.
  const unused = kb.services.filter((s) => {
    const words = normalize(s).split(" ");
    return ![...recentNorm].some((t) => words.every((w) => t.includes(w)));
  });
  const service = unused[0] || kb.services[0] || kb.category;
  const loc = kb.target_locations[0] || kb.city;
  return `${service} in ${loc}`;
}

function bestKeywordFor(topic, flat, kb) {
  const t = String(topic).toLowerCase();
  const scored = flat
    .map((k) => ({ k, hit: t.split(/\s+/).filter((w) => w.length > 3 && k.keyword.includes(w)).length }))
    .sort((a, b) => b.hit - a.hit || b.k.relevance_score - a.k.relevance_score);
  if (scored.length && scored[0].k) return scored[0].k.keyword;
  return `${(kb.services[0] || kb.category)} ${kb.target_locations[0] || kb.city}`.toLowerCase();
}
