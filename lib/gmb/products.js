import { uploadImage } from "../storage/index.js";
import { toPublicUrl } from "../utils.js";
import { fitPost } from "../ai/textPolicy.js";

const CTAS = ["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"];
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const money = (v) => (v === "" || v === null || v === undefined ? null : Math.max(0, Math.round(Number(v) * 100) / 100));

/** Same limits as Google's product form: name 58, description 1000, URL 1500. */
export function cleanProduct(f = {}) {
  const name = String(f.name || "").trim();
  if (!name) throw bad("Product name is required.");
  if (name.length > 58) throw bad("Product name: max 58 characters.");
  const price = money(f.price);
  const discounted = money(f.discounted_price);
  if (discounted != null && price != null && discounted >= price) throw bad("Discounted price must be lower than the price.");
  const url = String(f.landing_url || "").trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) throw bad("Landing page must be a full https:// URL.");
  return {
    name,
    category: String(f.category || "").trim().slice(0, 120) || null,
    price,
    discounted_price: discounted,
    currency: /^[A-Z]{3}$/.test(f.currency || "") ? f.currency : "INR",
    description: String(f.description || "").trim().slice(0, 1000) || null,
    landing_url: url.slice(0, 1500) || null,
    image_url: f.image_url || null,
    cta: CTAS.includes(f.cta) ? f.cta : url ? "ORDER" : "CALL",
    status: f.status === "HIDDEN" ? "HIDDEN" : "ACTIVE",
  };
}

export async function uploadProductImage(file) {
  if (file.size > 5 * 1024 * 1024) throw bad("Image must be under 5 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const png = buf[0] === 0x89 && buf[1] === 0x50;
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  if (!png && !jpg) throw bad("Use a JPG or PNG image (Google posts don't accept other formats).");
  const up = await uploadImage(buf, png ? "image/png" : "image/jpeg", `product-${Date.now()}.${png ? "png" : "jpg"}`);
  return up.url;
}

export async function readProduct(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) {
    const fd = await request.formData();
    const fields = {};
    for (const [k, v] of fd.entries()) if (typeof v === "string") fields[k] = v;
    const f = fd.get("image");
    return { fields, file: f && typeof f !== "string" && f.size ? f : null };
  }
  return { fields: await request.json().catch(() => ({})), file: null };
}

const fmt = (v, cur) => (cur === "INR" ? `₹${Number(v).toLocaleString("en-IN")}` : `${cur} ${v}`);

/** Product -> Google post payload (<=40 char title, <=250 char text + price line). */
export function productPost(p) {
  const priceLine = p.discounted_price != null && p.price != null
    ? `Now ${fmt(p.discounted_price, p.currency)} (was ${fmt(p.price, p.currency)}, ${Math.round((1 - p.discounted_price / p.price) * 100)}% off).`
    : p.price != null ? `Price: ${fmt(p.price, p.currency)}.` : "";
  const body = [String(p.description || "").replace(/https?:\/\/\S+/g, "").trim(), priceLine].filter(Boolean).join(" ");
  const fitted = fitPost(p.name, body);
  return {
    title: fitted.title,
    description: fitted.description.includes(priceLine) ? fitted.description : `${fitPost(p.name, String(p.description || "")).description} ${priceLine}`.trim(),
    cta: p.cta === "CALL" ? "Call now" : p.cta === "BOOK" ? "Book now" : p.cta === "SHOP" ? "Shop now" : p.cta === "ORDER" ? "Order now" : "Learn more",
    cta_action: p.cta,
    cta_url: p.landing_url || null,
    image_url: p.image_url,
    public_image_url: p.image_url ? toPublicUrl(p.image_url) : null,
    post_type: "Product/Service Highlight",
  };
}