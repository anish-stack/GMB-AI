import { NextResponse } from "next/server";
import { guard } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { providerFor } from "@/lib/gmb/provider";

/**
 * Shared wrapper for /api/gmb/[id]/* routes:
 * auth + permission + tenant ownership + per-client provider + uniform errors.
 *   export const GET = gmbRoute("gmb.view", async ({ provider, clientId, request, params }) => {...})
 */
export function gmbRoute(permission, handler) {
  return async function route(request, context) {
    const g = await guard(request, { permission });
    if (g.error) return g.error;
    const params = await context.params;
    const clientId = Number(params.id);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid client id." }, { status: 400 });
    }
    try {
      await assertClientInTenant(clientId, g.ctx.tenantId);
      const provider = await providerFor(clientId);
      const data = await handler({ request, params, clientId, provider, ctx: g.ctx });
      if (data instanceof Response) return data;
      return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      return NextResponse.json(
        { ok: false, error: err?.message || "Something went wrong", reason: err?.googleReason || null },
        { status, headers: err?.retryAfter ? { "Retry-After": String(err.retryAfter) } : {} },
      );
    }
  };
}

export async function readJson(request) {
  return request.json().catch(() => ({}));
}

export function requireMethod(provider, name) {
  if (typeof provider[name] !== "function") {
    const e = new Error("This action is not supported by the active GMB provider.");
    e.status = 501;
    throw e;
  }
}
