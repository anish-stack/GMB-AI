import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { insert, query, one } from "@/lib/db";
import { assertLimit } from "@/lib/saas/entitlements.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { permission: "calendar.view" });
  if (g.error) return g.error;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || new Date().toISOString().slice(0, 10);
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

export async function POST(request) {
  const g = await guard(request, { permission: "calendar.edit" });
  if (g.error) return g.error;
  const { ctx } = g;
  try {
    const body = await request.json();
    if (!body.client_id || !body.scheduled_date) {
      return NextResponse.json({ error: "Client and date are required" }, { status: 400 });
    }
    await assertClientInTenant(Number(body.client_id), ctx.tenantId);
    if (ctx.ent) assertLimit(ctx.ent, "max_scheduled_posts", 1);

    const client = await one("SELECT tenant_id FROM clients WHERE id=?", [Number(body.client_id)]);
    const id = await insert("content_calendar", {
      tenant_id: client.tenant_id,
      client_id: Number(body.client_id),
      scheduled_date: body.scheduled_date,
      post_type: body.post_type || "Service",
      topic: body.topic || null,
      status: "SCHEDULED",
      assigned_employee_id: body.assigned_employee_id || ctx.employeeId || null,
    });
    return NextResponse.json({ ok: true, id });
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
