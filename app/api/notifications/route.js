import { NextResponse } from "next/server";
import { guard } from "@/lib/saas/guard.js";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const { ctx } = g;
  const tid = ctx.tenantId;

  const stored = await query(
    `SELECT id, type, title, body, link, is_read, created_at FROM notifications
      WHERE ${tid ? "tenant_id=?" : "tenant_id IS NULL"}
      ORDER BY id DESC LIMIT 10`,
    tid ? [tid] : []
  );

  let derived = [];
  if (tid) {
    const rows = await query(
      `SELECT a.id, a.action, a.notes, a.user_name, a.created_at,
              t.id AS task_id, t.title, c.business_name
         FROM employee_approvals a
         JOIN ai_tasks t ON t.id = a.task_id
         JOIN clients c ON c.id = t.client_id
        WHERE t.tenant_id=?
        ORDER BY a.created_at DESC LIMIT 8`,
      [tid]
    );
    const failed = await query(
      `SELECT t.id AS task_id, t.title, t.updated_at, c.business_name
         FROM ai_tasks t JOIN clients c ON c.id = t.client_id
        WHERE t.status = 'FAILED' AND t.tenant_id=?
        ORDER BY t.updated_at DESC LIMIT 5`,
      [tid]
    );
    derived = [
      ...rows.map((r) => ({
        id: `a-${r.id}`,
        type: r.action,
        title: `${r.action.replaceAll("_", " ")} - ${r.business_name}`,
        detail: r.title || r.notes,
        taskId: r.task_id,
        at: r.created_at,
      })),
      ...failed.map((f) => ({
        id: `f-${f.task_id}`,
        type: "failed",
        title: `Generation failed - ${f.business_name}`,
        detail: f.title,
        taskId: f.task_id,
        at: f.updated_at,
      })),
    ];
  }

  const items = [
    ...stored.map((n) => ({
      id: `n-${n.id}`,
      type: n.type,
      title: n.title,
      detail: n.body,
      link: n.link,
      at: n.created_at,
    })),
    ...derived,
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 12);

  return NextResponse.json({ items });
}

export async function POST(request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const tid = g.ctx.tenantId;
  await query(
    `UPDATE notifications SET is_read=1 WHERE ${tid ? "tenant_id=?" : "tenant_id IS NULL"}`,
    tid ? [tid] : []
  );
  return NextResponse.json({ ok: true });
}
