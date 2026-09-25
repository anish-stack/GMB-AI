import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { buildGmbReport, reportToCsv, reportFilename } from "@/lib/reports/gmbReport.js";
import { queueEmail } from "@/lib/mail/queue.js";
import { gmbReportEmail } from "@/lib/mail/templates.js";

export const dynamic = "force-dynamic";

/**
 * GET  /api/gmb/:id/report?days=30        -> downloads the CSV (views/clicks/calls
 *                                             per day + recent posts) for this client.
 * POST /api/gmb/:id/report  {days, to?}   -> emails the same report to the GMB owner
 *                                             (client.google_email, captured at OAuth
 *                                             connect time) or to `to` if given.
 */
export async function GET(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;
  const { id } = await params;
  const clientId = Number(id);
  const days = Number(new URL(request.url).searchParams.get("days") || 30);

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);
    const report = await buildGmbReport(clientId, days);
    const csv = reportToCsv(report);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportFilename(report)}"`,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;
  const { id } = await params;
  const clientId = Number(id);

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);
    const body = await request.json().catch(() => ({}));
    const days = Number(body.days || 30);
    const report = await buildGmbReport(clientId, days);

    const to = body.to || report.client.google_email;
    if (!to) {
      return NextResponse.json(
        { error: "This client has no Google account email on file yet (connect their GMB first), and no 'to' address was given." },
        { status: 400 }
      );
    }

    const csv = reportToCsv(report);
    const tpl = gmbReportEmail({
      businessName: report.client.business_name,
      days,
      totals: report.totals,
      source: report.source,
      appUrl: process.env.APP_URL || null,
    });

    await queueEmail({
      to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      template: "gmb_report",
      tenantId: g.ctx.tenantId,
      meta: {
        attachment: {
          filename: reportFilename(report),
          contentType: "text/csv",
          contentBase64: Buffer.from(csv, "utf-8").toString("base64"),
        },
      },
    });

    return NextResponse.json({ ok: true, sent_to: to, days, totals: report.totals });
  } catch (err) {
    return apiError(err);
  }
}
