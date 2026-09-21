import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { grantCredits, getWallet, listLedger } from "@/lib/saas/credits.js";
import { query } from "@/lib/db";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  if (tenantId) {
    return NextResponse.json({
      wallet: await getWallet(Number(tenantId)),
      ledger: await listLedger(Number(tenantId), 100),
    });
  }
  const wallets = await query(
    `SELECT w.*, t.name AS tenant_name FROM credit_wallets w
       JOIN tenants t ON t.id=w.tenant_id ORDER BY w.lifetime_used DESC`
  );
  return NextResponse.json({ wallets });
}

export async function POST(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  try {
    const body = await request.json();
    const wallet = await grantCredits(Number(body.tenant_id), Number(body.credits || 0), {
      bucket: body.bucket === "PLAN" ? "PLAN" : "PURCHASED",
      reason: "ADMIN_GRANT",
      note: body.note || `Granted by ${g.ctx.name}`,
    });
    await audit(g.ctx, "ADMIN_CREDITS_GRANTED", {
      entity: "tenant",
      entityId: Number(body.tenant_id),
      meta: { credits: body.credits },
    });
    return NextResponse.json({ ok: true, wallet });
  } catch (err) {
    return apiError(err);
  }
}
