export const system = "You write image generation prompts. Respond with plain text only.";

export function build(kb, { topic, service, concept }) {
  return [
    concept || `Professional photo for a ${kb.category} in ${kb.city} about ${topic}`,
    `Business type: ${kb.category}`,
    service ? `Service shown: ${service}` : "",
    `Style: clean, professional, well-lit, realistic, brand-safe, no text, no logos, no watermarks`,
  ]
    .filter(Boolean)
    .join(". ");
}
