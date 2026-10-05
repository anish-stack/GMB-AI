import { query, one } from "../db.js";
import { toPublicUrl } from "../utils.js";
import { publishFacebook, publishInstagram } from "./meta.js";

/** After a GMB post goes live: copy it to the client's Facebook page / Instagram (if switched on). */
export async function autoPublishSocial(taskId) {
  const t = await one(
    `SELECT a.id, a.client_id, a.description, a.image_url, a.cta_url, c.website, ten.social_enabled
       FROM ai_tasks a JOIN clients c ON c.id=a.client_id JOIN tenants ten ON ten.id=a.tenant_id WHERE a.id=?`,
    [taskId],
  );
  if (!t || !Number(t.social_enabled)) return { skipped: "social not enabled" };
  const accs = await query("SELECT platform FROM social_accounts WHERE client_id=? AND auto_publish=1 AND status='ACTIVE'", [t.client_id]);
  if (!accs.length) return { skipped: "no auto-publish account" };
  const already = await query("SELECT platform FROM social_posts WHERE task_id=? AND status='PUBLISHED'", [taskId]);
  const done = new Set(already.map((r) => r.platform));
  const image = toPublicUrl(t.image_url);
  let link = t.cta_url || t.website || null;
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  const out = {};
  for (const { platform } of accs) {
    if (done.has(platform)) continue;
    try {
      out[platform] = platform === "instagram"
        ? image ? await publishInstagram(t.client_id, { caption: [t.description, link ? `🔗 ${link.replace(/^https?:\/\//, "")}` : ""].filter(Boolean).join("\n\n"), imageUrl: image, taskId, actor: "Auto-publish" }) : { skipped: "no public image" }
        : await publishFacebook(t.client_id, { message: t.description, imageUrl: image, link, taskId, actor: "Auto-publish" });
    } catch (err) {
      out[platform] = { error: err.message };
    }
  }
  return out;
}
