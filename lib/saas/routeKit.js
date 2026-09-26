import { NextResponse } from "next/server";
import { guard } from "./guard.js";

/**
 * Small wrapper for JSON routes: guard + uniform errors.
 *   export const GET = route({ superAdmin: true }, async ({ ctx, request, params }) => ({ items }))
 */
export function route(opts, handler) {
  return async function run(request, context) {
    const g = await guard(request, opts);
    if (g.error) return g.error;
    try {
      const params = context?.params ? await context.params : {};
      const data = await handler({ ctx: g.ctx, request, params });
      if (data instanceof Response) return data;
      return NextResponse.json({ ok: true, ...(data || {}) }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      const status = err?.status >= 400 && err?.status < 600 ? err.status : 500;
      if (status === 500) console.error("[route]", err);
      return NextResponse.json({ ok: false, error: status === 500 ? "Something went wrong" : err.message, code: err?.code || null, meta: err?.meta || null }, { status });
    }
  };
}

export const body = (request) => request.json().catch(() => ({}));
