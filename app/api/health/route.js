import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe for load balancers & uptime monitors. No internals exposed. */
export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({ status: "ok", time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
