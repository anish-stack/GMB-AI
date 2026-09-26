import { route } from "@/lib/saas/routeKit.js";
import { getPage, savePage, deletePage } from "@/lib/cms/pages.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export const GET = route({ superAdmin: true }, async ({ params }) => {
  const page = await getPage(Number(params.id), { publishedOnly: false });
  if (!page) throw Object.assign(new Error("Not found"), { status: 404 });
  return { page };
});

export const PUT = route({ superAdmin: true }, async ({ ctx, request, params }) => {
  const b = await request.json().catch(() => ({}));
  await savePage(Number(params.id), b, ctx.name);
  await audit(ctx, "CMS_PAGE_UPDATED", { entity: "cms_page", entityId: Number(params.id), meta: { slug: b.slug, status: b.status } });
  return { id: Number(params.id) };
});

export const DELETE = route({ superAdmin: true }, async ({ ctx, params }) => {
  await deletePage(Number(params.id));
  await audit(ctx, "CMS_PAGE_DELETED", { entity: "cms_page", entityId: Number(params.id) });
  return {};
});
