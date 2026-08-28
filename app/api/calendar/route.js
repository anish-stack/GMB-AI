import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { insert, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!(await getSession())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || new Date().toISOString().slice(0, 10);
  const rows = await query(
    `SELECT c.*, cl.business_name FROM content_calendar c
       JOIN clients cl ON cl.id=c.client_id
      WHERE c.scheduled_date >= ? ORDER BY c.scheduled_date, cl.business_name LIMIT 400`,
    [from]
  );
  return NextResponse.json({ entries: rows });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.client_id || !body.scheduled_date) {
      return NextResponse.json({ error: "Client and date are required" }, { status: 400 });
    }
    const id = await insert("content_calendar", {
      client_id: Number(body.client_id),
      scheduled_date: body.scheduled_date,
      post_type: body.post_type || "Service",
      topic: body.topic || null,
      status: "SCHEDULED",
      assigned_employee_id: body.assigned_employee_id || session.employeeId || null,
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!(await getSession())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await query("DELETE FROM content_calendar WHERE id=? AND status='SCHEDULED'", [id]);
  return NextResponse.json({ ok: true });
}
