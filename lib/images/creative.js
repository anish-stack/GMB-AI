import fs from "node:fs";
import path from "node:path";
import { createElement as h } from "react";
import { ImageResponse } from "next/og";

/**
 * Branded GBP post creative (1200x900, Google's recommended 4:3).
 * Full-bleed AI photo + readable overlay:
 *   - logo on a white card + business name (top-left)
 *   - image headline + supporting line on a dark gradient (always readable)
 *   - CTA pill (omitted when the post button is "None")
 * NO phone numbers and NO website on the image (client requirement).
 * Text is real typography - the AI only supplies the photo.
 */
const FONT_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "lib", "reports", "fonts");
let fonts = null;
function loadFonts() {
  if (fonts) return fonts;
  const read = (f) => {
    try {
      return fs.readFileSync(path.join(/*turbopackIgnore: true*/ FONT_DIR, f));
    } catch {
      return null;
    }
  };
  fonts = [
    { name: "Inter", data: read("inter-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Inter", data: read("inter-latin-600-normal.woff"), weight: 600, style: "normal" },
    { name: "Inter", data: read("inter-latin-700-normal.woff"), weight: 700, style: "normal" },
    { name: "Noto Deva", data: read("noto-sans-devanagari-devanagari-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Noto Deva", data: read("noto-sans-devanagari-devanagari-600-normal.woff"), weight: 700, style: "normal" },
  ].filter((f) => f.data);
  return fonts;
}

const SUPPORTED = /^image\/(png|jpe?g|gif)$/i;

/** Downloads an image (logo) into a data URL satori can embed. */
export async function toDataUrl(src) {
  if (!src) return null;
  if (String(src).startsWith("data:")) return SUPPORTED.test(String(src).slice(5, 20)) || String(src).startsWith("data:image/svg") ? src : null;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0];
    if (!SUPPORTED.test(type) && type !== "image/svg+xml") return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const SHADOW = "0 2px 12px rgba(0,0,0,0.55)";

/**
 * @returns {Promise<Buffer>} PNG
 */
export async function renderCreative({ photo = null, photoType = "image/png", logo = null, business, title, subtitle, cta, city, brand = "#0B2A5B", accent = "#F53236" }) {
  const photoUrl = photo && SUPPORTED.test(photoType) ? `data:${photoType};base64,${Buffer.from(photo).toString("base64")}` : null;
  const headline = String(title || "").trim();
  const titleSize = headline.length > 40 ? 64 : headline.length > 26 ? 74 : 86;
  const showCta = cta && !/^none$/i.test(String(cta).trim());
  const ff = "Inter, Noto Deva";

  const tree = h(
    "div",
    { style: { width: 1200, height: 900, display: "flex", position: "relative", fontFamily: ff, background: brand } },

    // background photo (or brand gradient when there is no photo)
    photoUrl
      ? h("img", { src: photoUrl, width: 1200, height: 900, style: { position: "absolute", left: 0, top: 0, width: 1200, height: 900, objectFit: "cover" } })
      : h("div", { style: { position: "absolute", left: 0, top: 0, width: 1200, height: 900, background: `linear-gradient(135deg, ${brand} 0%, #111827 100%)` } }),

    // readability scrims: left-to-right + bottom, so text always sits on dark
    h("div", { style: { position: "absolute", left: 0, top: 0, width: 1200, height: 900, background: "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.08) 80%)" } }),
    h("div", { style: { position: "absolute", left: 0, top: 0, width: 1200, height: 900, background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.6) 100%)" } }),

    // content
    h(
      "div",
      { style: { position: "absolute", left: 0, top: 0, width: 1200, height: 900, display: "flex", flexDirection: "column", padding: "52px 64px" } },

      // logo card + business name
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 20 } },
        h(
          "div",
          { style: { width: 112, height: 112, borderRadius: 24, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 24px rgba(0,0,0,0.35)" } },
          logo
            ? h("img", { src: logo, width: 92, height: 92, style: { width: 92, height: 92, objectFit: "contain" } })
            : h("div", { style: { fontSize: 44, fontWeight: 700, color: brand } }, initials(business)),
        ),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", maxWidth: 700 } },
          h("div", { style: { fontSize: 38, fontWeight: 700, color: "#ffffff", lineHeight: 1.1, textShadow: SHADOW } }, business),
          city ? h("div", { style: { fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 6, letterSpacing: 2, textShadow: SHADOW } }, String(city).toUpperCase()) : null,
        ),
      ),

      // headline block, vertically centred in the remaining space
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, maxWidth: 760 } },
        h("div", { style: { fontSize: titleSize, fontWeight: 700, color: "#ffffff", lineHeight: 1.06, letterSpacing: -1.5, display: "flex", flexWrap: "wrap", textShadow: SHADOW } }, headline),
        h("div", { style: { width: 120, height: 8, borderRadius: 4, background: accent, marginTop: 28 } }),
        subtitle ? h("div", { style: { marginTop: 24, fontSize: 32, fontWeight: 600, color: "rgba(255,255,255,0.95)", lineHeight: 1.3, maxWidth: 700, textShadow: SHADOW } }, subtitle) : null,
      ),

      // CTA pill (no phone, no website)
      showCta
        ? h("div", { style: { display: "flex" } },
            h("div", { style: { display: "flex", alignItems: "center", background: accent, color: "#ffffff", fontSize: 36, fontWeight: 700, padding: "22px 48px", borderRadius: 999, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" } }, cta))
        : null,
    ),
  );

  const res = new ImageResponse(tree, { width: 1200, height: 900, fonts: loadFonts() });
  return Buffer.from(await res.arrayBuffer());
}