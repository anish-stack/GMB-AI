import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { listCreditPacks, saveCreditPack } from "@/lib/saas/billing.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  return NextResponse.json({ packs: await listCreditPacks({ activeOnly: false }) });
}

export async function POST(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  try {
    const id = await saveCreditPack(await request.json());
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return apiError(err);
  }
}
