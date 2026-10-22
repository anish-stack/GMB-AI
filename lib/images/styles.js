import { query, one, insert, update } from "../db.js";

/**
 * Image styles (Admin -> Image styles). Each style decides HOW a post image is made:
 *   BRANDED_PHOTO - AI photo + our overlay (logo, headline, CTA)  <- the original look
 *   AI_POSTER     - the AI designs the whole creative incl. headline, points and button text
 *   PHOTO_ONLY    - plain AI photo
 * overlay (for AI_POSTER / PHOTO_ONLY): LOGO = add the client's logo card, NONE = untouched.
 * prompt: template with {{placeholders}} (see PLACEHOLDERS). Clients pick a style per GMB
 * profile; when none is picked the admin's default style is used.
 */
export const MODES = ["BRANDED_PHOTO", "AI_POSTER", "PHOTO_ONLY"];
export const OVERLAYS = ["FULL", "LOGO", "NONE"];
export const ASPECTS = ["4:3", "1:1", "16:9", "3:4"];

export const PLACEHOLDERS = [
  ["business", "Business name"], ["category", "Business category"], ["city", "City"], ["area", "Target area"],
  ["topic", "Post topic"], ["service", "Main service"], ["visual", "Scene / photo idea for this post"],
  ["headline", "Image headline"], ["subtitle", "Supporting line"], ["cta", "Button text"],
  ["point1", "Point 1"], ["point2", "Point 2"], ["point3", "Point 3"], ["point4", "Point 4"],
  ["brand_color", "Client brand colour"], ["keywords", "Main keywords"],
];

export const DEFAULT_PHOTO_PROMPT = [
  "{{visual}}",
  "Main subject: {{service}}",
  "Location and context: authentic Indian {{category}} environment in {{city}}, with realistic local surroundings and real people where appropriate",
  "Composition: ONE single full-bleed photograph covering the entire canvas edge-to-edge",
  "Do not create a split-screen composition, side panel, white panel, empty text column, framed card, collage, poster layout, brochure layout, or separate content section",
  "Keep the main subject slightly right or center-right when possible, while preserving natural negative space in the upper-left and lower-left areas for later text overlays",
  "The background photograph must continue naturally behind all areas of the canvas",
  "Photography: natural daylight or soft interior lighting, realistic 35mm photography, professional commercial photo, true-to-life colours, natural depth of field, candid composition",
  "Visual quality: premium, realistic, clean, modern Indian business advertising photography",
  "Important: generate photography only. No text, letters, typography, logos, watermarks, signage, brand names, CTA buttons, banners, borders, coloured bars, white boxes, or graphic panels",
  "No before-and-after layout, no medical gore, fully clothed people",
].join(". ");

export const DEFAULT_POSTER_PROMPT = `Design a professional, premium Google Business Profile post creative in landscape format for "{{business}}", a {{category}} in {{city}}.

LAYOUT
- Left side (about 55%): clean light background with the text.
- Right side (about 45%): a realistic, high-quality photo of {{visual}} - authentic Indian people and setting.
- Leave the top-left corner empty (logo goes there).

TEXT - render EXACTLY as written, correct spelling, no other words:
1. Large bold headline (2 lines max): "{{headline}}"
2. Smaller line under it: "{{subtitle}}"
3. A vertical list of 4 short points, each with a simple round line icon in {{brand_color}}:
   "{{point1}}" / "{{point2}}" / "{{point3}}" / "{{point4}}"

STYLE
Modern Indian service advertising, clean and trustworthy, soft shadows, generous white space, brand colour {{brand_color}} accents with dark navy text, sharp readable typography.
No buttons, no call-to-action badges, no phone numbers, no website addresses, no watermarks, no extra text, no misspellings.`;

export const SEED_STYLES = [
  { name: "Branded photo (classic)", description: "AI photo with your logo and headline added on top. Always readable.", mode: "BRANDED_PHOTO", overlay: "FULL", aspect: "4:3", prompt: DEFAULT_PHOTO_PROMPT, is_default: 1, sort: 1 },
  { name: "Designed poster", description: "AI designs the full ad - headline and 4 points with icons, with a real photo on the side.", mode: "AI_POSTER", overlay: "LOGO", aspect: "4:3", prompt: DEFAULT_POSTER_PROMPT, is_default: 0, sort: 2 },
  { name: "Clean photo", description: "Just a realistic photo, no text.", mode: "PHOTO_ONLY", overlay: "NONE", aspect: "4:3", prompt: DEFAULT_PHOTO_PROMPT, is_default: 0, sort: 3 },
];

const FALLBACK_POINTS = ["Experienced team", "Trusted local service", "Clear, honest guidance", "Quick support"];
const clip = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…`;
};

/** Admin setting "image_cta_button" (default OFF): draw a CTA button on post images? */
export async function imageButtonEnabled() {
  const { getSettings } = await import("../saas/settings.js");
  return Number((await getSettings()).image_cta_button ?? 0) === 1;
}

const NO_BUTTON_RULE =
  "\n\nIMPORTANT: do NOT draw any button, pill, badge or call-to-action (no \"Call now\", \"Book\", \"Learn more\" etc.) anywhere in the image.";

/** Removes button lines from (admin-edited / older) style prompts and adds a hard no-button rule. */
export function withoutButton(prompt) {
  const cleaned = String(prompt || "")
    .split("\n")
    .filter((l) => !/\bbutton\b|\{\{\s*cta\s*\}\}/i.test(l))
    .join("\n");
  return cleaned + NO_BUTTON_RULE;
}

/** Fills {{placeholders}}; unknown ones become empty. */
export function renderStyle(template, vars) {
  return String(template || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));
}

export function styleVars(kb, { topic, service, concept, title, subtitle, cta }, brandColor) {
  const services = (kb.services || []).filter(Boolean);
  const points = [...services.filter((s) => s !== service).slice(0, 4).map((s) => clip(s, 30))];
  for (const p of FALLBACK_POINTS) if (points.length < 4) points.push(p);
  return {
    business: kb.business || "",
    category: kb.category || "local business",
    city: kb.city || "",
    area: (kb.target_locations || [])[0] || kb.city || "",
    topic: topic || "",
    service: service || services[0] || kb.category || "",
    visual: concept || `a realistic scene at a ${kb.category || "local business"} in ${kb.city || "India"} about: ${topic || service || ""}`,
    headline: clip(title || topic || kb.business, 60),
    subtitle: clip(subtitle || `${kb.category || ""}${kb.city ? ` in ${kb.city}` : ""}`, 70),
    cta: !cta || /^none$/i.test(cta) ? "Call now" : clip(cta, 22),
    point1: points[0], point2: points[1], point3: points[2], point4: points[3],
    brand_color: /^#[0-9a-f]{6}$/i.test(brandColor || "") ? brandColor : "#0B2A5B",
    keywords: (kb.client_keywords?.length ? kb.client_keywords : kb.keywords || []).slice(0, 4).join(", "),
  };
}

export async function listStyles({ activeOnly = false } = {}) {
  const rows = await query(`SELECT * FROM image_styles ${activeOnly ? "WHERE active=1" : ""} ORDER BY sort, id`).catch(() => []);
  return rows;
}

/** Style for a client: ctx override -> client's choice -> admin default -> built-in classic. */
export async function resolveStyle(clientId, styleId = null) {
  try {
    if (styleId) {
      const s = await one("SELECT * FROM image_styles WHERE id=? AND active=1", [Number(styleId)]);
      if (s) return s;
    }
    const c = await one("SELECT s.* FROM clients c JOIN image_styles s ON s.id=c.image_style_id AND s.active=1 WHERE c.id=?", [clientId]);
    if (c) return c;
    const d = await one("SELECT * FROM image_styles WHERE active=1 ORDER BY is_default DESC, sort, id LIMIT 1");
    if (d) return d;
  } catch {
    /* table missing -> built-in */
  }
  return { id: null, ...SEED_STYLES[0] };
}

export function cleanStyleInput(b) {
  const out = {};
  if (b.name !== undefined) out.name = String(b.name).trim().slice(0, 80);
  if (b.description !== undefined) out.description = String(b.description || "").slice(0, 300);
  if (b.mode !== undefined) out.mode = MODES.includes(b.mode) ? b.mode : "BRANDED_PHOTO";
  if (b.overlay !== undefined) out.overlay = OVERLAYS.includes(b.overlay) ? b.overlay : "NONE";
  if (b.aspect !== undefined) out.aspect = ASPECTS.includes(b.aspect) ? b.aspect : "4:3";
  if (b.prompt !== undefined) out.prompt = String(b.prompt || "").slice(0, 8000);
  if (b.active !== undefined) out.active = b.active ? 1 : 0;
  if (b.sort !== undefined) out.sort = Number(b.sort) || 0;
  return out;
}

export async function saveStyle(id, b) {
  const data = cleanStyleInput(b);
  if (!id && (!data.name || !data.prompt)) throw Object.assign(new Error("Name and prompt are required"), { status: 400 });
  if (id) {
    if (Object.keys(data).length) await update("image_styles", Number(id), data);
  } else id = await insert("image_styles", { mode: "BRANDED_PHOTO", overlay: "FULL", aspect: "4:3", active: 1, ...data });
  if (b.is_default) {
    await query("UPDATE image_styles SET is_default=0");
    await query("UPDATE image_styles SET is_default=1, active=1 WHERE id=?", [Number(id)]);
  }
  return one("SELECT * FROM image_styles WHERE id=?", [Number(id)]);
}
