import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { createReportShare, csvFor } from "@/lib/reports/share.js";
import { buildGmbReport, reportFilename } from "@/lib/reports/gmbReport.js";
import { audit } from "@/lib/saas/audit.js";
import { assertUserRate } from "@/lib/api/rateLimiter.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const clampDays = (v) => Math.min(Math.max(parseInt(v, 10) || 30, 7), 365);

/** GET ?days=30&format=pdf|csv -> download (recorded in share history as DOWNLOAD). */
export async function GET(request, { params }) {
  const g = await guard(request, { permission: "gmb.view" });
  if (g.error) return g.error;
  const { id } = await params;
  const clientId = Number(id);
  const sp = new URL(request.url).searchParams;
  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);
    await assertUserRate(g.ctx.userId, "report", 20, 300);
    if (sp.get("format") === "csv") {
      const report = await buildGmbReport(clientId, clampDays(sp.get("days")));
      return new NextResponse(csvFor(report), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${reportFilename(report, "csv")}"` },
      });
    }
    const share = await createReportShare({ clientId, tenantId: g.ctx.tenantId, days: clampDays(sp.get("days")), method: "DOWNLOAD", actor: g.ctx });
    return new NextResponse(share.pdf, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${share.filename}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return apiError(err);
  }
}

/**
 * POST { days, method: EMAIL|LINK|WHATSAPP, to?, name?, phone? }
 * Shares the PDF with the business owner and stores the history row.
 */
export async function POST(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;
  const { id } = await params;
  const clientId = Number(id);
  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);
    await assertUserRate(g.ctx.userId, "report", 20, 300);
    const body = await request.json().catch(() => ({}));
    const method = ["EMAIL", "LINK", "WHATSAPP"].includes(body.method) ? body.method : "EMAIL";
    let to = body.to;
    if (method === "EMAIL" && !to) {
      const c = await (await import("@/lib/db")).one("SELECT google_email FROM clients WHERE id=?", [clientId]);
      to = c?.google_email;
      if (!to) return NextResponse.json({ error: "No owner email on file - enter the recipient's email." }, { status: 400 });
    }
    const share = await createReportShare({ clientId, tenantId: g.ctx.tenantId, days: clampDays(body.days), method, to, name: body.name, phone: body.phone, actor: g.ctx });
    await audit(g.ctx, "REPORT_SHARED", { entity: "client", entityId: clientId, meta: { method, to: to || body.phone || null, shareId: share.id } });
    return NextResponse.json({ ok: true, id: share.id, method, sent_to: to || body.phone || null, link: share.link, whatsapp: share.whatsapp });
  } catch (err) {
    return apiError(err);
  }
}
