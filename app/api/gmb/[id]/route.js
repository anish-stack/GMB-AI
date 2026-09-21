import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { updateGmbProfile, setGmbConnectionStatus, deleteGmbProfile } from "@/lib/repo/gmb.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    await assertClientInTenant(Number(id), g.ctx.tenantId);
    const body = await request.json();
    if (body.action === "activate") await setGmbConnectionStatus(Number(id), "MOCK_CONNECTED");
    else if (body.action === "deactivate") await setGmbConnectionStatus(Number(id), "DISCONNECTED");
    else await updateGmbProfile(Number(id), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    await assertClientInTenant(Number(id), g.ctx.tenantId);
    await deleteGmbProfile(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
