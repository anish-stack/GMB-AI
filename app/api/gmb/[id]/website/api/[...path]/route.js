import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { wbEmployee, clientWebsiteIds } from "@/lib/websiteBuilder.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Native website editor -> Website Builder employee API (server-side proxy).
 * Only these paths, and only for websites of THIS client:
 *   websites/:wid[/...]   pages/:pid[/...]   websites/:wid/pages   uploads/image
 */
const OID = "[a-f0-9]{24}";
const ALLOWED = [new RegExp(`^websites/(${OID})(/.*)?$`), new RegExp(`^pages/(${OID})(/.*)?$`), /^uploads\/image$/];

async function handle(request, { params }, method) {
  const g = await guard(request, { permission: method === "GET" ? "gmb.view" : "gmb.edit" });
  if (g.error) return g.error;
  try {
    const { id, path } = await params;
    const clientId = Number(id);
    await assertClientInTenant(clientId, g.ctx.tenantId);
    const p = (path || []).join("/");
    if (!ALLOWED.some((re) => re.test(p))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    const { ids } = await clientWebsiteIds(clientId, g.ctx.tenantId);
    const wid = p.match(new RegExp(`^websites/(${OID})`))?.[1];
    if (wid && !ids.has(wid)) return NextResponse.json({ error: "Website not found for this client" }, { status: 404 });
    const pid = p.match(new RegExp(`^pages/(${OID})`))?.[1];
    if (pid) {
      const pg = await wbEmployee(g.ctx.tenantId, `pages/${pid}`);
      const owner = String(pg.page?.website?._id || pg.page?.website || "");
      if (!ids.has(owner)) return NextResponse.json({ error: "Page not found for this client" }, { status: 404 });
      if (method === "GET" && p === `pages/${pid}`) return NextResponse.json({ ok: true, ...pg });
    }

    const search = new URL(request.url).search;
    let body = null;
    if (method !== "GET" && method !== "DELETE") {
      const type = request.headers.get("content-type") || "";
      if (type.includes("multipart/form-data")) {
        const fd = await request.formData();
        for (const [, v] of fd.entries()) if (typeof v !== "string" && v.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Image too large (max 8 MB)" }, { status: 400 });
        body = fd;
      } else body = await request.json().catch(() => ({}));
    }
    const r = await wbEmployee(g.ctx.tenantId, `${p}${search}`, { method, body });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return apiError(err);
  }
}

export const GET = (req, ctx) => handle(req, ctx, "GET");
export const POST = (req, ctx) => handle(req, ctx, "POST");
export const PATCH = (req, ctx) => handle(req, ctx, "PATCH");
export const PUT = (req, ctx) => handle(req, ctx, "PUT");
export const DELETE = (req, ctx) => handle(req, ctx, "DELETE");
