import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { one, query, update } from "@/lib/db";
import { cleanProduct, uploadProductImage, readProduct } from "@/lib/gmb/products.js";

export const dynamic = "force-dynamic";

async function load(request, params, permission) {
  const g = await guard(request, { permission });
  if (g.error) return { error: g.error };
  const { id, pid } = await params;
  await assertClientInTenant(Number(id), g.ctx.tenantId);
  const p = await one("SELECT * FROM gmb_products WHERE id=? AND client_id=?", [Number(pid), Number(id)]);
  if (!p) return { error: NextResponse.json({ error: "Product not found" }, { status: 404 }) };
  return { ctx: g.ctx, product: p };
}

export async function PATCH(request, { params }) {
  try {
    const r = await load(request, params, "gmb.edit");
    if (r.error) return r.error;
    const { fields, file } = await readProduct(request);
    const data = cleanProduct({ ...r.product, ...fields });
    if (file) data.image_url = await uploadProductImage(file);
    await update("gmb_products", r.product.id, data);
    return NextResponse.json({ ok: true, item: await one("SELECT * FROM gmb_products WHERE id=?", [r.product.id]) });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const r = await load(request, params, "gmb.edit");
    if (r.error) return r.error;
    await query("DELETE FROM gmb_products WHERE id=?", [r.product.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
