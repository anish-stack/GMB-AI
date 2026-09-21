import { NextResponse } from "next/server";
import { guard } from "@/lib/saas/guard.js";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ clients: [], tasks: [] });
  const like = `%${q}%`;
  const tid = g.ctx.tenantId;

  const [clients, tasks] = await Promise.all([
    query(
      `SELECT id, business_name, city FROM clients
        WHERE (business_name LIKE ? OR city LIKE ?)${tid ? " AND tenant_id=?" : ""}
        ORDER BY business_name LIMIT 6`,
      tid ? [like, like, tid] : [like, like]
    ),
    query(
      `SELECT t.id, t.title, t.status, c.business_name
         FROM ai_tasks t JOIN clients c ON c.id = t.client_id
        WHERE (t.title LIKE ? OR t.topic LIKE ? OR c.business_name LIKE ?)${tid ? " AND t.tenant_id=?" : ""}
        ORDER BY t.updated_at DESC LIMIT 6`,
      tid ? [like, like, like, tid] : [like, like, like]
    ),
  ]);

  return NextResponse.json({ clients, tasks });
}
