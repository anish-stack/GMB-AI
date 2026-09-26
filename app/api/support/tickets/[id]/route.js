import { route } from "@/lib/saas/routeKit.js";
import { getTicket, replyToTicket, readTicketBody, updateTicketMeta } from "@/lib/support/tickets.js";
import { audit, notify } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx, params }) => ({ ticket: await getTicket(params.id, { tenantId: ctx.tenantId }) }));

/** Client reply (JSON or multipart). */
export const POST = route({}, async ({ ctx, request, params }) => {
  const { fields, files } = await readTicketBody(request);
  const t = await replyToTicket(params.id, { user: { id: ctx.userId, name: ctx.name }, role: "CLIENT", body: fields.message, files, tenantId: ctx.tenantId });
  await notify({ type: "SUPPORT", title: `Client replied on ${t.ticket_no}`, body: t.subject, link: `/admin/support/${t.id}` });
  return { ticket: await getTicket(t.id, { tenantId: ctx.tenantId }) };
});

/** Client may close or re-open their own ticket. */
export const PATCH = route({}, async ({ ctx, request, params }) => {
  const b = await request.json().catch(() => ({}));
  await getTicket(params.id, { tenantId: ctx.tenantId });
  if (!["CLOSED", "OPEN"].includes(b.status)) throw Object.assign(new Error("Clients can only close or re-open."), { status: 400 });
  await updateTicketMeta(params.id, { status: b.status });
  await audit(ctx, "TICKET_STATUS_CHANGED", { entity: "ticket", entityId: Number(params.id), meta: { status: b.status } });
  return { ticket: await getTicket(params.id, { tenantId: ctx.tenantId }) };
});
