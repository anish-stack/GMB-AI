import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { readSheet, importCalendar, templateXlsx } from "@/lib/posting/calendarImport.js";
import { assertLimit } from "@/lib/saas/entitlements.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET -> Excel template */
export async function GET(request) {
  const g = await guard(request, { permission: "calendar.edit" });
  if (g.error) return g.error;
  return new NextResponse(await templateXlsx(), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="post-calendar-template.xlsx"' },
  });
}

/** POST multipart: file (.xlsx/.csv), client_id (optional default), commit=1 to save. Always validates first. */
export async function POST(request) {
  const g = await guard(request, { permission: "calendar.edit" });
  if (g.error) return g.error;
  try {
    const fd = await request.formData();
    const file = fd.get("file");
    if (!file || typeof file === "string") return NextResponse.json({ error: "Upload an .xlsx or .csv file" }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 2 MB)" }, { status: 400 });
    if (!/\.(xlsx|csv)$/i.test(file.name || "")) return NextResponse.json({ error: "Only .xlsx or .csv files" }, { status: 400 });
    const rows = await readSheet(Buffer.from(await file.arrayBuffer()), file.name);
    if (!rows.length) return NextResponse.json({ error: "No rows found - use the template" }, { status: 400 });
    const commit = String(fd.get("commit") || "") === "1";
    if (commit && g.ctx.ent) assertLimit(g.ctx.ent, "max_scheduled_posts", rows.length);
    const res = await importCalendar({ tenantId: g.ctx.tenantId, rows, defaultClientId: fd.get("client_id") || null, commit, employeeId: g.ctx.employeeId || null });
    if (res.committed) await audit(g.ctx, "CALENDAR_IMPORTED", { meta: res.summary });
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    return apiError(err);
  }
}
