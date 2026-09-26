import { openSharedReport } from "@/lib/reports/share.js";

export const dynamic = "force-dynamic";

/** Public link the business owner receives. Token is random, stored hashed, expires; views are counted. */
export async function GET(_request, { params }) {
  const { token } = await params;
  const res = await openSharedReport(token).catch(() => null);
  if (!res) {
    return new Response("<!doctype html><meta name=viewport content='width=device-width'><title>Link expired</title><body style='font-family:system-ui;display:grid;place-items:center;min-height:90vh;color:#3f3f46'><div style='text-align:center'><h1 style='font-size:20px'>This report link has expired</h1><p>Ask your agency to share a fresh report.</p></div>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response(res.pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="gmb-report-${String(res.row.period_end).slice(0, 10)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
