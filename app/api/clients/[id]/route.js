import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { getClient, updateClient, setClientActive, deleteClient } from "@/lib/repo/clients.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const g = await guard(request, { permission: "client.view" });
  if (g.error) return g.error;
  const { id } = await params;
  const client = await getClient(Number(id), g.ctx.tenantId);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json({ client });
}

export async function PATCH(request, { params }) {
  const g = await guard(request, { permission: "client.edit" });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    const body = await request.json();
    if (body.action === "activate") await setClientActive(Number(id), true, g.ctx.tenantId);
    else if (body.action === "deactivate") await setClientActive(Number(id), false, g.ctx.tenantId);
    else await updateClient(Number(id), body, g.ctx.tenantId);
    await audit(g.ctx, "CLIENT_UPDATED", { entity: "client", entityId: Number(id), meta: { action: body.action || "edit" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request, { params }) {
  const g = await guard(request, { permission: "client.delete" });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    await deleteClient(Number(id), g.ctx.tenantId);
    await audit(g.ctx, "CLIENT_DELETED", { entity: "client", entityId: Number(id) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
