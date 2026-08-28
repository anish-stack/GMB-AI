export const system =
  "You generate GMB hashtags. Respond with a single valid JSON object and nothing else.";

export function build(kb, { title, topic, primaryKeyword }) {
  return `Business: ${kb.business} (${kb.category}) in ${kb.city}
Topic: ${topic}
Title: ${title}
Primary keyword: ${primaryKeyword}

Generate 5-7 relevant hashtags. CamelCase, no spaces, no special characters, no numbers-only tags.

Return JSON: { "hashtags": ["#Example"] }`;
}
