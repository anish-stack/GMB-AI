export const system =
  "You write image generation prompts for full-bleed commercial photography. Respond with plain text only.";

export function build(kb, { topic, service, concept }) {
  return [
    concept ||
      `A realistic commercial photography scene at a ${kb.category} in ${kb.city}, illustrating: ${topic}`,

    service ? `Main subject: ${service}` : "",

    `Location and context: authentic Indian ${kb.category.toLowerCase()} environment in ${kb.city}, with realistic local surroundings and real people where appropriate`,

    "Composition: ONE single full-bleed photograph covering the entire canvas edge-to-edge",

    "Do not create a split-screen composition, side panel, white panel, empty text column, framed card, collage, poster layout, brochure layout, or separate content section",

    "Keep the main subject slightly right or center-right when possible, while preserving natural negative space in the upper-left and lower-left areas for later text overlays",

    "The background photograph must continue naturally behind all areas of the canvas",

    "Photography: natural daylight or soft interior lighting, realistic 35mm photography, professional commercial photo, true-to-life colours, natural depth of field, candid composition",

    "Visual quality: premium, realistic, clean, modern Indian business advertising photography",

    "Important: generate photography only. No text, letters, typography, logos, watermarks, signage, brand names, CTA buttons, banners, borders, coloured bars, white boxes, or graphic panels",

    "No before-and-after layout, no medical gore, fully clothed people",
  ]
    .filter(Boolean)
    .join(". ");
}