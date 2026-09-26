export const system =
  "You generate hashtags for Google Business Profile posts shared to social channels. Respond with a single valid JSON object and nothing else.";

export function build(kb, { title, topic, primaryKeyword }) {
  return `Business: ${kb.business} (${kb.category}) in ${kb.city}
Topic: ${topic}
Title: ${title}
Primary keyword: ${primaryKeyword}

Generate 5-7 hashtags: 2 local (city/locality), 2-3 service, 1 brand, 1 topical.
CamelCase, no spaces, no special characters, no numbers-only tags, no generic spam (#Love, #InstaGood).

Return JSON: { "hashtags": ["#Example"] }`;
}
