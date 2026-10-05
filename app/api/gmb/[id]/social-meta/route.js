import { route } from "@/lib/saas/routeKit.js";
import { query, one, insert } from "@/lib/db";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { toPublicUrl } from "@/lib/utils.js";
import {
  assertSocialEnabled, metaConfig, accounts, listPages, connectPage, disconnect, saveSettings,
  publishFacebook, publishInstagram, facebookPosts, instagramMedia,
} from "@/lib/social/meta.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bad = (m, s = 400) => Object.assign(new Error(m), { status: s });

/** GET -> { enabled, configured, accounts, recent posts log, dm rules, dm log } */
export const GET = route({ permission: "gmb.view" }, async ({ ctx, params }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  const t = await one("SELECT social_enabled FROM tenants WHERE id=?", [ctx.tenantId]);
  const cfg = await metaConfig();
  if (!Number(t?.social_enabled)) return { enabled: false, configured: cfg.configured };
  const [acc, log, rules, dms] = await Promise.all([
    accounts(id),
    query("SELECT id, platform, external_id, permalink, LEFT(message,160) message, image_url, status, error, created_by, created_at FROM social_posts WHERE client_id=? ORDER BY id DESC LIMIT 30", [id]),
    query("SELECT id, keywords, reply, active FROM ig_dm_rules WHERE client_id=? ORDER BY id", [id]),
    query("SELECT id, sender_id, LEFT(message,300) message, LEFT(reply,300) reply, source, error, created_at FROM ig_dm_log WHERE client_id=? ORDER BY id DESC LIMIT 30", [id]),
  ]);
  return { enabled: true, configured: cfg.configured, accounts: acc, log, rules, dms };
});

/**
 * POST { action, ... }
 *  pages {pick} · connect {pick, page_id, instagram} · disconnect {platform}
 *  settings {platform, auto_publish, dm_auto_reply, dm_use_ai, dm_fallback}
 *  publish {platform, message, image_url, link, task_id} · feed {platform}
 *  rule_add {keywords, reply} · rule_toggle {rule_id} · rule_delete {rule_id}
 */
export const POST = route({ permission: "gmb.edit" }, async ({ ctx, params, request }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  await assertSocialEnabled(ctx.tenantId);
  const b = await request.json().catch(() => ({}));
  const platform = b.platform === "instagram" ? "instagram" : "facebook";

  switch (b.action) {
    case "pages":
      return { pages: await listPages(b.pick, id, ctx.tenantId) };
    case "connect": {
      const r = await connectPage({ pick: b.pick, clientId: id, tenantId: ctx.tenantId, pageId: b.page_id, withInstagram: b.instagram !== false, actor: ctx.name });
      await audit(ctx, "SOCIAL_CONNECTED", { entity: "client", entityId: id, meta: r });
      return r;
    }
    case "disconnect":
      await disconnect(id, platform);
      await audit(ctx, "SOCIAL_DISCONNECTED", { entity: "client", entityId: id, meta: { platform } });
      return {};
    case "settings":
      await saveSettings(id, platform, b);
      return { accounts: await accounts(id) };
    case "feed":
      return { items: platform === "instagram" ? await instagramMedia(id) : await facebookPosts(id) };
    case "publish": {
      let message = String(b.message || "").trim();
      let image = b.image_url ? String(b.image_url) : null;
      let link = b.link ? String(b.link) : null;
      if (b.task_id) {
        const t = await one("SELECT description, image_url, cta_url FROM ai_tasks WHERE id=? AND client_id=? AND tenant_id=?", [Number(b.task_id), id, ctx.tenantId]);
        if (!t) throw bad("Post not found", 404);
        message = message || t.description;
        image = image || toPublicUrl(t.image_url);
        if (!link) link = t.cta_url || (await one("SELECT website FROM clients WHERE id=?", [id]))?.website || null;
      }
      if (!message && !image) throw bad("Write something or add an image.");
      if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
      const r = platform === "instagram"
        ? await publishInstagram(id, { caption: [message, link ? `🔗 ${link.replace(/^https?:\/\//, "")}` : ""].filter(Boolean).join("\n\n"), imageUrl: image, taskId: b.task_id || null, actor: ctx.name })
        : await publishFacebook(id, { message, imageUrl: image, link, taskId: b.task_id || null, actor: ctx.name });
      await audit(ctx, "SOCIAL_POSTED", { entity: "client", entityId: id, meta: { platform, id: r.id } });
      return r;
    }
    case "rule_add": {
      const keywords = String(b.keywords || "").split(",").map((k) => k.trim()).filter(Boolean).join(", ");
      const reply = String(b.reply || "").trim();
      if (!keywords || !reply) throw bad("Keywords and reply are required.");
      const rid = await insert("ig_dm_rules", { client_id: id, keywords: keywords.slice(0, 500), reply: reply.slice(0, 1000) });
      return { id: rid };
    }
    case "rule_toggle":
      await query("UPDATE ig_dm_rules SET active=1-active WHERE id=? AND client_id=?", [Number(b.rule_id), id]);
      return {};
    case "rule_delete":
      await query("DELETE FROM ig_dm_rules WHERE id=? AND client_id=?", [Number(b.rule_id), id]);
      return {};
    default:
      throw bad("Unknown action");
  }
});
