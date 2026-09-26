import { route } from "@/lib/saas/routeKit.js";
import { createTicket, listTickets, readTicketBody } from "@/lib/support/tickets.js";
import { audit } from "@/lib/saas/audit.js";
import { notify } from "@/lib/saas/audit.js";
import { assertUserRate } from "@/lib/api/rateLimiter.js";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx, request }) => {
  const sp = new URL(request.url).searchParams;
  const page = Math.max(parseInt(sp.get("page"), 10) || 1, 1);
  return { page, ...(await listTickets({ tenantId: ctx.tenantId, status: sp.get("status"), q: (sp.get("q") || "").slice(0, 80), limit: 20, offset: (page - 1) * 20 })) };
});

/** JSON or multipart (fields + files[]) */
export const POST = route({}, async ({ ctx, request }) => {
  if (!ctx.tenantId) throw Object.assign(new Error("Workspace required"), { status: 400 });
  await assertUserRate(ctx.userId, "ticket", 5, 600);
  const { fields, files } = await readTicketBody(request);
  const t = await createTicket({ tenantId: ctx.tenantId, user: { id: ctx.userId, name: ctx.name }, subject: fields.subject, category: fields.category, priority: fields.priority, message: fields.message, clientId: fields.client_id || null, files });
  await audit(ctx, "TICKET_CREATED", { entity: "ticket", entityId: t.id, meta: { no: t.ticket_no, priority: t.priority } });
  await notify({ type: "SUPPORT", title: `New ticket ${t.ticket_no} (${t.priority})`, body: `${t.tenant_name}: ${t.subject}`, link: `/admin/support/${t.id}` });
  return { ticket: t };
});
