import { NextResponse, after } from "next/server";
import { getIntegration } from "@/lib/integrations/store.js";
import { safeEqual } from "@/lib/security/crypto.js";
import { handleGbpNotification } from "@/lib/reviews/pubsub.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Google Cloud Pub/Sub push endpoint for Business Profile notifications.
 * Subscription URL: {APP_URL}/api/gmb/pubsub?token=<Push endpoint token from Admin -> Integrations -> Google>
 * Acks immediately (Pub/Sub deadline is short) and processes after the response.
 */
export async function POST(request) {
  const g = await getIntegration("google").catch(() => null);
  const expected = g?.values?.pubsub_push_token;
  const token = new URL(request.url).searchParams.get("token");
  if (!expected || !safeEqual(token, expected)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const raw = body?.message?.data;
  if (!raw) return new NextResponse(null, { status: 204 });
  let data;
  try {
    data = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return new NextResponse(null, { status: 204 }); // malformed - ack so it isn't redelivered forever
  }
  after(() => handleGbpNotification(data).catch((err) => console.error("[pubsub]", err.message)));
  return new NextResponse(null, { status: 204 });
}
