import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { query, insert } from "@/lib/db";
import { cleanProduct, uploadProductImage, readProduct } from "@/lib/gmb/products.js";

export const dynamic = "force-dynamic";

async function ctxFor(request, params, permission) {
  const g = await guard(request, { permission });
  if (g.error) return { error: g.error };
  const { id } = await params;
  const clientId = Number(id);
  await assertClientInTenant(clientId, g.ctx.tenantId);
  return { ctx: g.ctx, clientId };
}

export async function GET(request, { params }) {
  try {
    const r = await ctxFor(request, params, "gmb.view");
    if (r.error) return r.error;
    const items = await query("SELECT * FROM gmb_products WHERE client_id=? ORDER BY id DESC", [r.clientId]);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return apiError(err);
  }
}

/** POST multipart (fields + optional image) or JSON. */
export async function POST(request, { params }) {
  try {
    const r = await ctxFor(request, params, "gmb.edit");
    if (r.error) return r.error;
    const { fields, file } = await readProduct(request);
    const data = cleanProduct(fields);
    if (file) data.image_url = await uploadProductImage(file);
    const id = await insert("gmb_products", { ...data, tenant_id: r.ctx.tenantId, client_id: r.clientId });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return apiError(err);
  }
}
