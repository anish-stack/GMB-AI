import { route } from "@/lib/saas/routeKit.js";
import { getTicket, replyToTicket, readTicketBody, updateTicketMeta } from "@/lib/support/tickets.js";
import { audit } from "@/lib/saas/audit.js";
import { sendNotification } from "@/lib/notifications/service.js";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = route({ superAdmin: true }, async ({ params }) => ({
  ticket: await getTicket(params.id, { includeInternal: true }),
  admins: await query("SELECT id, name FROM users WHERE role='SUPER_ADMIN' AND active=1 ORDER BY name"),
}));

/** Admin reply { message, internal? } (JSON or multipart). Notifies the ticket owner. */
export const POST = route({ superAdmin: true }, async ({ ctx, request, params }) => {
  const { fields, files } = await readTicketBody(request);
  const internal = fields.internal === "1" || fields.internal === true || fields.internal === "true";
  const t = await replyToTicket(params.id, { user: { id: ctx.userId, name: ctx.name }, role: "ADMIN", body: fields.message, files, internal });
  if (!internal && t.user_id) {
    await sendNotification({ userIds: [t.user_id], type: "SUPPORT", title: `Support replied on ${t.ticket_no}`, body: t.subject, link: `/support/${t.id}`, push: true });
  }
  await audit(ctx, "TICKET_REPLIED", { entity: "ticket", entityId: t.id, meta: { internal } });
  return { ticket: await getTicket(t.id, { includeInternal: true }) };
});

/** { status?, priority?, assigned_to_user_id? } */
export const PATCH = route({ superAdmin: true }, async ({ ctx, request, params }) => {
  const b = await request.json().catch(() => ({}));
  const { before, patch } = await updateTicketMeta(params.id, b);
  if (patch.status && patch.status !== before.status && before.user_id) {
    await sendNotification({ userIds: [before.user_id], type: "SUPPORT", title: `${before.ticket_no} is now ${patch.status.replaceAll("_", " ").toLowerCase()}`, body: before.subject, link: `/support/${before.id}`, push: true });
  }
  await audit({ ...ctx, tenantId: before.tenant_id }, "TICKET_UPDATED", { entity: "ticket", entityId: before.id, meta: patch });
  return { ticket: await getTicket(params.id, { includeInternal: true }) };
});
