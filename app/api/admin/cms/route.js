import { route } from "@/lib/saas/routeKit.js";
import { listPages, savePage } from "@/lib/cms/pages.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export const GET = route({ superAdmin: true }, async () => ({ items: await listPages() }));

export const POST = route({ superAdmin: true }, async ({ ctx, request }) => {
  const id = await savePage(null, await request.json().catch(() => ({})), ctx.name);
  await audit(ctx, "CMS_PAGE_CREATED", { entity: "cms_page", entityId: id });
  return { id };
});
