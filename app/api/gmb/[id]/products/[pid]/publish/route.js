import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { one, update } from "@/lib/db";
import { publishProviderFor } from "@/lib/gmb/provider.js";
import { productPost } from "@/lib/gmb/products.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

/**
 * Google's public API has no Products endpoint, so a product is published as a
 * Google post (image + price + Buy/Order button). Edit the Products tab itself in
 * Business Profile Manager.
 */
export async function POST(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;
  try {
    const { id, pid } = await params;
    const clientId = Number(id);
    await assertClientInTenant(clientId, g.ctx.tenantId);
    const p = await one("SELECT * FROM gmb_products WHERE id=? AND client_id=?", [Number(pid), clientId]);
    if (!p) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    const provider = await publishProviderFor(clientId);
    const result = await provider.createPost(clientId, { tenant_id: g.ctx.tenantId, ...productPost(p) });
    await update("gmb_products", p.id, { last_posted_at: new Date() });
    await audit(g.ctx, "PRODUCT_POSTED", { entity: "client", entityId: clientId, meta: { product: p.id } });
    return NextResponse.json({ ok: true, post: result, mock: Boolean(provider.isMock) });
  } catch (err) {
    return apiError(err);
  }
}
