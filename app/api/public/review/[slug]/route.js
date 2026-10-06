import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const insertId = async (sql, params) => {
  const r = await query(sql, params);
  return r?.insertId || null;
};
import { flowBySlug, suggestReviews, ipHash } from "@/lib/reviews/flow.js";
import { rateLimit, clientIp } from "@/lib/security/rateLimit.js";

export const dynamic = "force-dynamic";

/**
 * Public (no login) - used by the page behind the review QR.
 * POST { action: "scan" } | { action: "suggest", rating, picks, extra, lang }
 *      | { action: "feedback", rating, picks, message, name, contact } | { action: "google", rating }
 */
export async function POST(request, { params }) {
  const { slug } = await params;
  const ip = clientIp(request);
  const rl = await rateLimit(`review-flow:${ip}`, { max: 40, windowSec: 600 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests - try again in a few minutes." }, { status: 429 });
  const flow = await flowBySlug(slug);
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const rating = Math.min(5, Math.max(1, Number(b.rating) || 5));
  const picks = (Array.isArray(b.picks) ? b.picks : []).map((x) => String(x).slice(0, 40)).slice(0, 12);

  switch (b.action) {
    case "scan":
      await query("UPDATE review_flows SET scans=scans+1 WHERE client_id=?", [flow.client_id]);
      return NextResponse.json({ ok: true });
    case "suggest": {
      const ai = await rateLimit(`review-suggest:${ip}`, { max: 6, windowSec: 600 });
      if (!ai.allowed) return NextResponse.json({ error: "Please wait a little before generating again." }, { status: 429 });
      const reviews = await suggestReviews(flow, { rating, picks, extra: String(b.extra || ""), lang: ["English", "Hindi", "Hinglish"].includes(b.lang) ? b.lang : "English" });
      return NextResponse.json({ ok: true, reviews });
    }
    case "google": {
      // the review text the customer chose is SAVED here, then they post it on Google
      // (Google has no API for posting a review on someone's behalf)
      const text = String(b.text || "").trim().slice(0, 4000);
      let savedId = null;
      if (text) {
        savedId = await insertId(
          "INSERT INTO review_feedback (client_id, rating, answers, message, name, kind, status, lang, went_to_google, ip_hash) VALUES (?,?,?,?,?,'GOOGLE','SENT_TO_GOOGLE',?,1,?)",
          [flow.client_id, rating, JSON.stringify(picks), text, String(b.name || "").slice(0, 120) || null, String(b.lang || "").slice(0, 20) || null, ipHash(ip)],
        );
      }
      await query("UPDATE review_flows SET google_clicks=google_clicks+1 WHERE client_id=?", [flow.client_id]);
      return NextResponse.json({ ok: true, url: flow.reviewUrl, saved: Boolean(savedId) });
    }
    case "feedback": {
      const message = String(b.message || "").trim().slice(0, 2000);
      if (!message) return NextResponse.json({ error: "Please write a few words." }, { status: 400 });
      await query("INSERT INTO review_feedback (client_id, rating, answers, message, name, contact, ip_hash, kind, status) VALUES (?,?,?,?,?,?,?,'PRIVATE','SAVED')", [
        flow.client_id, rating, JSON.stringify(picks), message, String(b.name || "").slice(0, 120) || null, String(b.contact || "").slice(0, 160) || null, ipHash(ip),
      ]);
      await query("UPDATE review_flows SET feedback_count=feedback_count+1 WHERE client_id=?", [flow.client_id]);
      const { sendNotification } = await import("@/lib/notifications/service.js");
      await sendNotification({ tenantId: flow.tenant_id, type: rating <= 2 ? "ALERT" : "INFO", title: `Private feedback (${rating}★) - ${flow.business_name}`, body: message.slice(0, 160), link: `/gmb/${flow.client_id}/review-qr`, push: rating <= 2 }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}