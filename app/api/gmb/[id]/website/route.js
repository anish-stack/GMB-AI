import { route } from "@/lib/saas/routeKit.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { wbConfig, syncBuilderClient, ssoUrl, setLive, deleteSite, listThemes, checkSlug, createFromGmb, refillFromGmb } from "@/lib/websiteBuilder.js";
import { buildPrefill, suggestSlug } from "@/lib/websitePrefill.js";
import { after } from "next/server";
import { assertAiImagesAllowed, generateWebsiteImages, plannedImages } from "@/lib/websiteAiImages.js";
import { aiImagesAvailable } from "@/lib/images/imageService.js";
import { creditCostFor } from "@/lib/saas/credits.js";
import { one } from "@/lib/db";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET -> { configured, websites:[{id,slug,isLive,url,themeKey,updatedAt}] } */
export const GET = route({ permission: "gmb.view" }, async ({ ctx, params }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  const cfg = await wbConfig();
  if (!cfg.configured) return { configured: false, websites: [] };
  const r = await syncBuilderClient(id, ctx.tenantId);
  return { configured: true, builderClientId: r.builderClientId, websites: r.websites };
});

/**
 * POST { action: "create" | "edit" | "publish" | "unpublish" | "delete", website_id? }
 * create/edit return { url } - the builder panel opened already signed in.
 */
export const POST = route({ permission: "gmb.edit" }, async ({ ctx, params, request }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  const b = await request.json().catch(() => ({}));
  const wid = String(b.website_id || "").replace(/[^\w-]/g, "");
  switch (b.action) {
    case "create": {
      const r = await syncBuilderClient(id, ctx.tenantId);
      return { url: await ssoUrl(ctx.tenantId, `/websites/new?clientId=${encodeURIComponent(r.builderClientId)}`) };
    }
    case "edit":
      if (!wid) throw Object.assign(new Error("website_id required"), { status: 400 });
      return { url: await ssoUrl(ctx.tenantId, `/websites/${wid}`) };
    case "dashboard":
      return { url: await ssoUrl(ctx.tenantId, "/websites") };
    case "publish":
    case "unpublish": {
      const r = await setLive(ctx.tenantId, wid, b.action === "publish");
      await audit(ctx, b.action === "publish" ? "WEBSITE_PUBLISHED" : "WEBSITE_UNPUBLISHED", { entity: "client", entityId: id, meta: { website: wid } });
      return { isLive: r.isLive, liveUrl: r.liveUrl };
    }
    case "themes": {
      const c = await one("SELECT business_name FROM clients WHERE id=?", [id]);
      const slug = suggestSlug(c?.business_name);
      return { themes: await listThemes(), suggestedSlug: slug, slugCheck: await checkSlug(slug) };
    }
    case "check_slug":
      return checkSlug(String(b.slug || ""));
    case "preview": {
      // what will be filled - shown in the dialog before creating
      const prefill = await buildPrefill(id);
      const n = plannedImages(prefill);
      return { prefill, ai: { available: aiImagesAvailable(), images: n, credits: n * (Number(await creditCostFor("image").catch(() => 0)) || 0) } };
    }
    case "create_from_gmb": {
      if (!b.theme_id || !b.slug) throw Object.assign(new Error("Pick a theme and a web address."), { status: 400 });
      const prefill = await buildPrefill(id);
      const useAi = b.images === "ai";
      // check plan / provider / credits BEFORE creating anything
      if (useAi) await assertAiImagesAllowed(ctx.tenantId, plannedImages(prefill));
      const site = await createFromGmb(id, ctx.tenantId, { themeId: String(b.theme_id), slug: String(b.slug), prefill });
      if (useAi) after(() => generateWebsiteImages({ clientId: id, tenantId: ctx.tenantId, websiteId: site.id, prefill }).catch((e) => console.error("[website ai images]", e.message)));
      await audit(ctx, "WEBSITE_CREATED_FROM_GMB", { entity: "client", entityId: id, meta: { website: site.id, slug: site.slug, images: useAi ? "ai" : "manual" } });
      return { site, aiImages: useAi ? plannedImages(prefill) : 0 };
    }
    case "ai_images": {
      if (!wid) throw Object.assign(new Error("website_id required"), { status: 400 });
      const prefill = await buildPrefill(id);
      await assertAiImagesAllowed(ctx.tenantId, plannedImages(prefill));
      after(() => generateWebsiteImages({ clientId: id, tenantId: ctx.tenantId, websiteId: wid, prefill }).catch((e) => console.error("[website ai images]", e.message)));
      await audit(ctx, "WEBSITE_AI_IMAGES", { entity: "client", entityId: id, meta: { website: wid } });
      return { started: plannedImages(prefill) };
    }
    case "refill": {
      const prefill = await buildPrefill(id);
      const site = await refillFromGmb(ctx.tenantId, wid, prefill, b.mode === "overwrite" ? "overwrite" : "fill");
      await audit(ctx, "WEBSITE_REFILLED_FROM_GMB", { entity: "client", entityId: id, meta: { website: wid, mode: b.mode || "fill" } });
      return { site };
    }
    case "delete":
      await deleteSite(ctx.tenantId, wid);
      await audit(ctx, "WEBSITE_DELETED", { entity: "client", entityId: id, meta: { website: wid } });
      return {};
    default:
      throw Object.assign(new Error("Unknown action"), { status: 400 });
  }
});
