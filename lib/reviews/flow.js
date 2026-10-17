import { REVIEW_SUGGEST_SYSTEM } from "../ai/prompts/misc.js";
import crypto from "node:crypto";
import { query, one } from "../db.js";
import { runAI } from "../ai/index.js";
import { listingLinks } from "../gmb/links.js";

/**
 * Smart review flow behind the review QR code:
 *   stars -> "what did you like?" chips -> AI writes 3 review drafts in the
 *   customer's words -> copy & open Google's review box.
 * Low ratings are offered a private feedback form FIRST, but the Google option
 * is always available (Google forbids "review gating").
 */
export const DEFAULT_STEPS = [
  { id: "liked", title: "What did you enjoy most about your visit?", type: "multiselect", options: ["Friendly staff", "Great service", "Clean place", "Professional team", "Quick service", "Quality work"] },
  { id: "highlights", title: "Any specific highlight?", type: "multiselect", options: ["Expert advice", "Fair pricing", "Great communication", "Attention to detail", "On-time", "Easy booking"] },
];

export const DEFAULT_POSTER = {
  style: "minimal", // vibrant | minimal | midnight | cream
  accent: "#0EA5E9",
  headline: "Rate us on Google",
  subtitle: "We value your feedback!",
  steps: ["Open your phone camera", "Scan the QR code", "Rate us & post a review"],
  footer: "",
};

const slugify = (s) => String(s || "review").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 50) || "review";

async function uniqueSlug(name, clientId) {
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const s = i ? `${base}-${i + 1}` : base;
    const hit = await one("SELECT client_id FROM review_flows WHERE slug=?", [s]);
    if (!hit || hit.client_id === clientId) return s;
  }
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

const parse = (v, fb) => {
  try {
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
};

export async function getFlow(clientId) {
  let f = await one("SELECT * FROM review_flows WHERE client_id=?", [clientId]);
  if (!f) {
    const c = await one("SELECT tenant_id, business_name FROM clients WHERE id=?", [clientId]);
    if (!c) throw Object.assign(new Error("Client not found"), { status: 404 });
    const slug = await uniqueSlug(c.business_name, clientId);
    await query("INSERT IGNORE INTO review_flows (client_id, tenant_id, slug, mode, steps, poster) VALUES (?,?,?,?,?,?)", [clientId, c.tenant_id, slug, "AI", JSON.stringify(DEFAULT_STEPS), JSON.stringify(DEFAULT_POSTER)]);
    f = await one("SELECT * FROM review_flows WHERE client_id=?", [clientId]);
  }
  return { ...f, steps: parse(f.steps, DEFAULT_STEPS), poster: { ...DEFAULT_POSTER, ...parse(f.poster, {}) } };
}

export async function saveFlow(clientId, b) {
  const cur = await getFlow(clientId);
  const steps = Array.isArray(b.steps)
    ? b.steps.slice(0, 6).map((s, i) => ({
        id: String(s.id || `step${i + 1}`).replace(/[^\w-]/g, "").slice(0, 30) || `step${i + 1}`,
        title: String(s.title || "").trim().slice(0, 120) || "Question",
        type: "multiselect",
        options: (Array.isArray(s.options) ? s.options : []).map((o) => String(o).trim().slice(0, 40)).filter(Boolean).slice(0, 12),
      }))
    : cur.steps;
  const poster = b.poster ? {
    style: ["vibrant", "minimal", "midnight", "cream"].includes(b.poster.style) ? b.poster.style : cur.poster.style,
    accent: /^#[0-9a-f]{6}$/i.test(b.poster.accent || "") ? b.poster.accent : cur.poster.accent,
    headline: String(b.poster.headline ?? cur.poster.headline).slice(0, 32),
    subtitle: String(b.poster.subtitle ?? cur.poster.subtitle).slice(0, 50),
    steps: (Array.isArray(b.poster.steps) ? b.poster.steps : cur.poster.steps).slice(0, 3).map((x) => String(x).slice(0, 28)),
    footer: String(b.poster.footer ?? cur.poster.footer ?? "").slice(0, 60),
  } : cur.poster;
  const mode = b.mode === "DIRECT" ? "DIRECT" : b.mode === "AI" ? "AI" : cur.mode;
  const threshold = b.threshold ? Math.min(5, Math.max(1, Number(b.threshold))) : cur.threshold;
  await query("UPDATE review_flows SET mode=?, steps=?, poster=?, threshold=? WHERE client_id=?", [mode, JSON.stringify(steps), JSON.stringify(poster), threshold, clientId]);
  return getFlow(clientId);
}

export async function flowBySlug(slug) {
  const f = await one(
    `SELECT f.*, c.business_name, c.business_category, c.city, c.logo_url, c.brand_color, c.active
       FROM review_flows f JOIN clients c ON c.id=f.client_id WHERE f.slug=?`,
    [String(slug || "").slice(0, 80)],
  );
  if (!f || !Number(f.active)) return null;
  const links = await listingLinks(f.client_id);
  return { ...f, steps: parse(f.steps, DEFAULT_STEPS), poster: { ...DEFAULT_POSTER, ...parse(f.poster, {}) }, reviewUrl: links?.review || null };
}

/** 3 review drafts written from the customer's own choices (never invented facts). */
export async function suggestReviews(flow, { rating, picks = [], extra = "", lang = "English" }) {
  const chosen = picks.map((p) => String(p).slice(0, 40)).slice(0, 12);
  const fallback = () => {
    const a = chosen.length ? chosen.slice(0, 3).join(", ").toLowerCase() : "the service";
    return [
      `${"Great"} experience at ${flow.business_name}. Loved ${a}. Highly recommended!`,
      `Visited ${flow.business_name}${flow.city ? ` in ${flow.city}` : ""} and was impressed - ${a}. Will definitely come back.`,
      `${rating}/5 for ${flow.business_name}. ${chosen.length ? `Especially liked ${a}.` : "Smooth and professional."} ${extra ? String(extra).slice(0, 140) : "Thank you team!"}`,
    ];
  };
  try {
    const { data } = await runAI({
      agent: "review_suggest",
      system: REVIEW_SUGGEST_SYSTEM,
      prompt: `Business: ${flow.business_name} (${flow.business_category || "local business"}${flow.city ? `, ${flow.city}` : ""})
Star rating given: ${rating}/5
What they liked: ${chosen.join(", ") || "-"}
Their own words: ${String(extra || "-").slice(0, 400)}
Language: ${lang === "Hindi" ? "Hindi (Devanagari)" : lang === "Hinglish" ? "Hinglish (Hindi in Roman script)" : "English"}
Write 3 different reviews: 1) short (1-2 sentences) 2) medium (2-3 sentences) 3) detailed (4-5 sentences).`,
      meta: { agent: "review_suggest" },
      clientId: flow.client_id,
      maxTokens: 1200,
      temperature: 0.8,
    });
    const list = (Array.isArray(data?.reviews) ? data.reviews : []).map((r) => String(r).trim()).filter((r) => r.length > 10).slice(0, 3);
    return list.length === 3 ? list : fallback();
  } catch {
    return fallback();
  }
}

export const ipHash = (ip) => crypto.createHash("sha256").update(`${process.env.SESSION_SECRET || ""}:${ip || ""}`).digest("hex").slice(0, 32);

/* ---------- did the customer actually post it? ---------- */
const words = (t) => new Set(String(t || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2));

/** Word-overlap similarity 0..1 between the drafted text and a real Google review. */
export function similarity(a, b) {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}

/**
 * Marks QR-flow reviews as LIVE_ON_GOOGLE when a synced Google review (review inbox)
 * has the same text (customers often edit a little -> 60 % word overlap) and was
 * posted after the draft was written. Runs when the studio opens.
 */
export async function matchGoogleReviews(clientId) {
  const pending = await query(
    "SELECT id, rating, message, created_at FROM review_feedback WHERE client_id=? AND kind='GOOGLE' AND status<>'LIVE_ON_GOOGLE' AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) ORDER BY id DESC LIMIT 200",
    [clientId],
  );
  if (!pending.length) return 0;
  const google = await query(
    "SELECT review_id, rating, comment, review_created_at FROM review_inbox WHERE client_id=? AND comment IS NOT NULL AND review_created_at >= DATE_SUB(NOW(), INTERVAL 62 DAY)",
    [clientId],
  ).catch(() => []);
  const used = new Set((await query("SELECT matched_review_id FROM review_feedback WHERE client_id=? AND matched_review_id IS NOT NULL", [clientId])).map((r) => r.matched_review_id));
  let n = 0;
  for (const p of pending) {
    const hit = google
      .filter((g) => !used.has(g.review_id) && new Date(g.review_created_at).getTime() >= new Date(p.created_at).getTime() - 3600000)
      .map((g) => ({ g, s: similarity(p.message, g.comment) }))
      .filter((x) => x.s >= 0.6)
      .sort((a, b) => b.s - a.s)[0];
    if (hit) {
      await query("UPDATE review_feedback SET status='LIVE_ON_GOOGLE', matched_review_id=?, matched_at=NOW() WHERE id=?", [hit.g.review_id, p.id]);
      used.add(hit.g.review_id);
      n++;
    }
  }
  return n;
}