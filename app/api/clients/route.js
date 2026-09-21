import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { listClients, createClient } from "@/lib/repo/clients.js";
import { assertLimit } from "@/lib/saas/entitlements.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { permission: "client.view" });
  if (g.error) return g.error;
  return NextResponse.json({ clients: await listClients(g.ctx.tenantId) });
}

export async function POST(request) {
  const g = await guard(request, { permission: "client.create" });
  if (g.error) return g.error;
  const { ctx } = g;
  try {
    if (!ctx.tenantId) return NextResponse.json({ error: "Super admin cannot own clients" }, { status: 400 });
    assertLimit(ctx.ent, "max_clients", 1);

    const body = await request.json();
    if (!body.business_name || !body.business_category) {
      return NextResponse.json({ error: "Business name and category are required" }, { status: 400 });
    }
    const id = await createClient(body, ctx.tenantId);
    await audit(ctx, "CLIENT_CREATED", { entity: "client", entityId: id, meta: { name: body.business_name } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return apiError(err);
  }
}
