import { NextResponse } from "next/server";
import { guard } from "@/lib/saas/guard.js";
import { one } from "@/lib/db";
import { readAttachment } from "@/lib/support/tickets.js";

export const dynamic = "force-dynamic";

/** Only the ticket's tenant or a super admin can open an attachment. */
export async function GET(request, { params }) {
  const g = await guard(request);
  if (g.error) return g.error;
  const { key } = await params;
  const row = await one(
    `SELECT t.tenant_id, m.attachments FROM support_ticket_messages m JOIN support_tickets t ON t.id=m.ticket_id
      WHERE m.attachments LIKE ? LIMIT 1`,
    [`%"key":"${String(key).replace(/[^0-9a-z.-]/g, "")}"%`],
  );
  if (!row || (!g.ctx.isSuperAdmin && row.tenant_id !== g.ctx.tenantId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const meta = JSON.parse(row.attachments).find((a) => a.key === key);
  const buf = await readAttachment(key).catch(() => null);
  if (!buf || !meta) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(buf, { headers: { "Content-Type": meta.type, "Content-Disposition": `inline; filename="${meta.name}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
