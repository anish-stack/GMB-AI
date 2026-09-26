import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { one } from "@/lib/db";
import { readStoredPdf } from "@/lib/reports/share.js";

export const dynamic = "force-dynamic";

/** Re-download a previously shared PDF (tenant-scoped). */
export async function GET(request, { params }) {
  const g = await guard(request, { permission: "gmb.view" });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    const row = await one("SELECT file_key, period_end, client_id FROM report_shares WHERE id=? AND tenant_id=?", [Number(id), g.ctx.tenantId]);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const pdf = await readStoredPdf(row.file_key);
    return new NextResponse(pdf, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="gmb-report-${row.client_id}-${String(row.period_end).slice(0, 10)}.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return apiError(err);
  }
}
