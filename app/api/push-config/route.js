import { NextResponse } from "next/server";
import { publicFirebaseConfig } from "@/lib/integrations/store.js";

export const dynamic = "force-dynamic";

/** Public Firebase web config (these values are public by design - no secrets). */
export async function GET() {
  return NextResponse.json({ firebase: await publicFirebaseConfig() }, { headers: { "Cache-Control": "public, max-age=300" } });
}
