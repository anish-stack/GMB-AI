import { NextResponse, after } from "next/server";
import { metaConfig, verifySignature } from "@/lib/social/meta.js";
import { handleWebhook } from "@/lib/social/dm.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Meta app webhook (Instagram "messages").
 * Callback URL: {APP_URL}/api/meta/webhook · Verify token: Admin -> Integrations -> Meta.
 */
export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const cfg = await metaConfig();
  if (sp.get("hub.mode") === "subscribe" && cfg.verifyToken && sp.get("hub.verify_token") === cfg.verifyToken) {
    return new Response(sp.get("hub.challenge") || "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function POST(request) {
  const raw = await request.text();
  const cfg = await metaConfig();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), cfg.appSecret)) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("ok");
  }
  // answer Meta immediately; reply to DMs after the response
  after(() => handleWebhook(body).catch((e) => console.error("[meta webhook]", e.message)));
  return new Response("EVENT_RECEIVED", { status: 200 });
}
