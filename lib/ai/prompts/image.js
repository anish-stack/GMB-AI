export const system = "You write image generation prompts. Respond with plain text only.";

export function build(kb, { topic, service, concept }) {
  return [
    concept || `A real-life scene at a ${kb.category} in ${kb.city}, illustrating: ${topic}`,
    service ? `Subject: ${service}` : "",
    `Setting: an Indian ${kb.category.toLowerCase()} in ${kb.city}, authentic local context, real people where appropriate`,
    "Photography: natural daylight or soft interior light, 35mm lens look, shallow depth of field, true-to-life colours, candid composition",
    "Brand-safe: no text, no letters, no logos, no watermarks, no signage, no brand names, no before/after, no medical gore, fully clothed people",
  ]
    .filter(Boolean)
    .join(". ");
}
