import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { saveCreditPack, deleteCreditPack } from "@/lib/saas/billing.js";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;
  try {
    await saveCreditPack(await request.json(), Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request, { params }) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;
  await deleteCreditPack(Number(id));
  return NextResponse.json({ ok: true });
}
