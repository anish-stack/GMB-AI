import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { insert, query, one } from "@/lib/db";
import { assertLimit } from "@/lib/saas/entitlements.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { assertCanSchedule, withPlanLock } from "@/lib/posting/plan.js";
import { POST_TYPES } from "@/lib/constants.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { permission: "calendar.view" });
  if (g.error) return g.error;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || new Date().toLocaleDateString("en-CA");
  const params = [from];
  let sql = `SELECT c.*, cl.business_name FROM content_calendar c
               JOIN clients cl ON cl.id=c.client_id
              WHERE c.scheduled_date >= ?`;
  if (g.ctx.tenantId) {
    sql += " AND c.tenant_id=?";
    params.push(g.ctx.tenantId);
  }
  sql += " ORDER BY c.scheduled_date, cl.business_name LIMIT 400";
  return NextResponse.json({ entries: await query(sql, params) });
}

/**
 * POST { client_id, scheduled_date, post_type?, topic? }            -> one slot
 * POST { client_id, dates: ["YYYY-MM-DD", ...], post_type?, topic? } -> bulk / recurring
 * Every date is validated against the client's posting plan (weekly + total caps,
 * plan window, posting days) BEFORE anything is inserted - all or nothing.
 */
export async function POST(request) {
  const g = await guard(request, { permission: "calendar.edit" });
  if (g.error) return g.error;
  const { ctx } = g;
  try {
    const body = await request.json();
    const clientId = Number(body.client_id);
    const dates = Array.isArray(body.dates) ? body.dates : body.scheduled_date ? [body.scheduled_date] : [];
    if (!clientId || !dates.length) {
      return NextResponse.json({ error: "Client and at least one date are required" }, { status: 400 });
    }
    if (dates.length > 120) return NextResponse.json({ error: "Max 120 dates per request" }, { status: 400 });
    const postType = POST_TYPES.includes(body.post_type) ? body.post_type : "Service";
    await assertClientInTenant(clientId, ctx.tenantId);
    if (ctx.ent) assertLimit(ctx.ent, "max_scheduled_posts", dates.length);

    const client = await one("SELECT tenant_id FROM clients WHERE id=?", [clientId]);
    const ids = await withPlanLock(clientId, async () => {
      await assertCanSchedule(clientId, dates);
      const out = [];
      for (const d of dates) {
        out.push(
          await insert("content_calendar", {
            tenant_id: client.tenant_id,
            client_id: clientId,
            scheduled_date: String(d).slice(0, 10),
            post_type: postType,
            topic: body.topic ? String(body.topic).slice(0, 200) : null,
            status: "SCHEDULED",
            assigned_employee_id: body.assigned_employee_id || ctx.employeeId || null,
          }),
        );
      }
      return out;
    });
    return NextResponse.json({ ok: true, id: ids[0], ids });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request) {
  const g = await guard(request, { permission: "calendar.edit" });
  if (g.error) return g.error;
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const params = [id];
  let sql = "DELETE FROM content_calendar WHERE id=? AND status='SCHEDULED'";
  if (g.ctx.tenantId) {
    sql += " AND tenant_id=?";
    params.push(g.ctx.tenantId);
  }
  await query(sql, params);
  return NextResponse.json({ ok: true });
}
