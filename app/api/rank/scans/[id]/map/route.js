import { NextResponse } from "next/server";
import { guard } from "@/lib/saas/guard.js";
import { getScan, staticMap } from "@/lib/rank/grid.js";

export const dynamic = "force-dynamic";

/** Map background for the heatmap - proxied so the Google key never reaches the browser. */
export async function GET(request, { params }) {
  const g = await guard(request, { permission: "gmb.view" });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    const scan = await getScan(id, g.ctx.tenantId);
    const img = await staticMap(scan);
    if (!img) return NextResponse.json({ error: "No map" }, { status: 404 });
    return new NextResponse(img.buf, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400", "X-Map-Zoom": String(img.zoom) } });
  } catch {
    return NextResponse.json({ error: "No map" }, { status: 404 });
  }
}
