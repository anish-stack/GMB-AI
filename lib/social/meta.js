import crypto from "node:crypto";
import { query, one, insert, update } from "../db.js";
import { getIntegration } from "../integrations/store.js";
import { encryptToken, decryptToken } from "../gmb/googleAuth.js";
import { createState, readState } from "../gmb/bulkConnect.js";

/**
 * Facebook Page + Instagram (Business/Creator, linked to the page) via the Meta Graph API.
 * TEST MODE: only tenants a super admin enabled (tenants.social_enabled) can use it, and while
 * the Meta app is in Development mode only people with a role on the app (admin/developer/tester)
 * can connect. Page tokens obtained from a long-lived user token do not expire.
 */
const bad = (m, status = 400) => Object.assign(new Error(m), { status });

export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_metadata",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_messages",
  "instagram_manage_comments",
];

export async function metaConfig() {
  const i = await getIntegration("meta").catch(() => null);
  const v = i?.values || {};
  const appId = v.app_id || process.env.META_APP_ID || "";
  const appSecret = v.app_secret || process.env.META_APP_SECRET || "";
  const verifyToken = v.webhook_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN || "";
  const version = v.graph_version || process.env.META_GRAPH_VERSION || "v21.0";
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  return {
    appId, appSecret, verifyToken, version,
    graph: `https://graph.facebook.com/${version}`,
    redirectUri: process.env.META_REDIRECT_URI || `${base}/api/social/callback`,
    configured: Boolean((i ? i.enabled !== false : true) && appId && appSecret),
  };
}

export async function assertSocialEnabled(tenantId) {
  const t = await one("SELECT social_enabled FROM tenants WHERE id=?", [tenantId]);
  if (!Number(t?.social_enabled)) throw bad("Facebook & Instagram tools are in test mode - ask the platform admin to enable them for your workspace.", 403);
  const cfg = await metaConfig();
  if (!cfg.configured) throw bad("Meta app is not configured (Admin -> Integrations -> Meta).", 503);
  return cfg;
}

async function graph(cfg, path, { method = "GET", params = {}, token }) {
  const url = new URL(`${cfg.graph}/${path.replace(/^\//, "")}`);
  const opts = { method, signal: AbortSignal.timeout(30000) };
  const all = { ...params, ...(token ? { access_token: token } : {}) };
  if (method === "GET") for (const [k, v] of Object.entries(all)) url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  else {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(all);
  }
  const res = await fetch(url, opts);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw bad(`Meta: ${j.error?.message || res.status}`.slice(0, 300), res.status === 401 || j.error?.code === 190 ? 401 : 502);
  return j;
}

/* ---------------- connect ---------------- */
export async function authUrl(clientId, tenantId, actor) {
  const cfg = await assertSocialEnabled(tenantId);
  const state = createState({ k: "meta", c: clientId, t: tenantId, u: actor });
  const p = new URLSearchParams({ client_id: cfg.appId, redirect_uri: cfg.redirectUri, state, scope: META_SCOPES.join(","), response_type: "code" });
  return `https://www.facebook.com/${cfg.version}/dialog/oauth?${p}`;
}

/** OAuth callback: code -> long-lived user token, parked for 30 min until a page is picked. */
export async function handleCallback(code, stateToken) {
  const st = readState(stateToken);
  if (!st || st.k !== "meta") throw bad("Connection link expired - try again.");
  const cfg = await assertSocialEnabled(st.t);
  const short = await graph(cfg, "oauth/access_token", { params: { client_id: cfg.appId, client_secret: cfg.appSecret, redirect_uri: cfg.redirectUri, code } });
  const long = await graph(cfg, "oauth/access_token", { params: { grant_type: "fb_exchange_token", client_id: cfg.appId, client_secret: cfg.appSecret, fb_exchange_token: short.access_token } });
  const id = crypto.randomBytes(16).toString("hex");
  await query("DELETE FROM meta_pending WHERE expires_at < NOW()");
  await insert("meta_pending", { id, tenant_id: st.t, client_id: st.c, user_token_enc: encryptToken(long.access_token), expires_at: new Date(Date.now() + 30 * 60000) });
  return { clientId: st.c, pick: id };
}

async function pending(pick, clientId, tenantId) {
  const p = await one("SELECT * FROM meta_pending WHERE id=? AND client_id=? AND tenant_id=? AND expires_at > NOW()", [String(pick || ""), clientId, tenantId]);
  if (!p) throw bad("This Facebook sign-in expired - click Connect again.", 410);
  return p;
}

/** Pages (and their linked Instagram accounts) the signed-in Facebook user manages. */
export async function listPages(pick, clientId, tenantId) {
  const cfg = await assertSocialEnabled(tenantId);
  const p = await pending(pick, clientId, tenantId);
  const j = await graph(cfg, "me/accounts", { token: decryptToken(p.user_token_enc), params: { fields: "id,name,picture{url},instagram_business_account{id,username,profile_picture_url}", limit: 100 } });
  return (j.data || []).map((x) => ({
    id: x.id,
    name: x.name,
    picture: x.picture?.data?.url || null,
    instagram: x.instagram_business_account ? { id: x.instagram_business_account.id, username: x.instagram_business_account.username, picture: x.instagram_business_account.profile_picture_url || null } : null,
  }));
}

/** Saves the page (and optionally its Instagram) for this client. */
export async function connectPage({ pick, clientId, tenantId, pageId, withInstagram = true, actor }) {
  const cfg = await assertSocialEnabled(tenantId);
  const p = await pending(pick, clientId, tenantId);
  const j = await graph(cfg, "me/accounts", { token: decryptToken(p.user_token_enc), params: { fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}", limit: 100 } });
  const page = (j.data || []).find((x) => x.id === String(pageId));
  if (!page) throw bad("That page isn't available on this Facebook account.", 404);
  const token = encryptToken(page.access_token);
  const upsert = async (platform, extra) => {
    await query(
      `INSERT INTO social_accounts (tenant_id, client_id, platform, page_id, page_name, ig_user_id, ig_username, picture_url, access_token_enc, connected_by, status, last_error)
       VALUES (?,?,?,?,?,?,?,?,?,?,'ACTIVE',NULL)
       ON DUPLICATE KEY UPDATE page_id=VALUES(page_id), page_name=VALUES(page_name), ig_user_id=VALUES(ig_user_id), ig_username=VALUES(ig_username),
         picture_url=VALUES(picture_url), access_token_enc=VALUES(access_token_enc), connected_by=VALUES(connected_by), status='ACTIVE', last_error=NULL`,
      [tenantId, clientId, platform, page.id, page.name, extra.ig_user_id || null, extra.ig_username || null, extra.picture || null, token, actor || null],
    );
  };
  await upsert("facebook", { picture: page.picture?.data?.url });
  const ig = page.instagram_business_account;
  if (withInstagram && ig) {
    await upsert("instagram", { ig_user_id: ig.id, ig_username: ig.username, picture: ig.profile_picture_url });
    // receive Instagram messages for this page (webhook must be set up on the Meta app)
    await graph(cfg, `${page.id}/subscribed_apps`, { method: "POST", token: page.access_token, params: { subscribed_fields: "messages" } }).catch(() => null);
  }
  await query("DELETE FROM meta_pending WHERE id=?", [p.id]);
  return { facebook: page.name, instagram: withInstagram && ig ? ig.username : null };
}

export async function accounts(clientId) {
  const rows = await query("SELECT id, platform, page_id, page_name, ig_user_id, ig_username, picture_url, auto_publish, dm_auto_reply, dm_use_ai, dm_fallback, status, last_error, connected_by, updated_at FROM social_accounts WHERE client_id=?", [clientId]);
  return { facebook: rows.find((r) => r.platform === "facebook") || null, instagram: rows.find((r) => r.platform === "instagram") || null };
}

async function account(clientId, platform) {
  const a = await one("SELECT * FROM social_accounts WHERE client_id=? AND platform=?", [clientId, platform]);
  if (!a) throw bad(`${platform === "facebook" ? "Facebook page" : "Instagram"} is not connected for this client.`, 404);
  return { ...a, token: decryptToken(a.access_token_enc) };
}

export async function disconnect(clientId, platform) {
  await query("DELETE FROM social_accounts WHERE client_id=? AND platform=?", [clientId, platform]);
}

export async function saveSettings(clientId, platform, s) {
  const patch = {};
  if (s.auto_publish !== undefined) patch.auto_publish = s.auto_publish ? 1 : 0;
  if (platform === "instagram") {
    if (s.dm_auto_reply !== undefined) patch.dm_auto_reply = s.dm_auto_reply ? 1 : 0;
    if (s.dm_use_ai !== undefined) patch.dm_use_ai = s.dm_use_ai ? 1 : 0;
    if (s.dm_fallback !== undefined) patch.dm_fallback = String(s.dm_fallback || "").slice(0, 1000) || null;
  }
  const a = await one("SELECT id FROM social_accounts WHERE client_id=? AND platform=?", [clientId, platform]);
  if (!a) throw bad("Not connected", 404);
  if (Object.keys(patch).length) await update("social_accounts", a.id, patch);
}

/* ---------------- publish ---------------- */
async function logPost(a, row) {
  return insert("social_posts", { tenant_id: a.tenant_id, client_id: a.client_id, platform: a.platform, ...row });
}

export async function publishFacebook(clientId, { message, imageUrl = null, link = null, taskId = null, actor = null }) {
  const cfg = await metaConfig();
  const a = await account(clientId, "facebook");
  const text = [String(message || "").trim(), link && !imageUrl ? "" : link || ""].filter(Boolean).join("\n\n").slice(0, 60000);
  try {
    const r = imageUrl
      ? await graph(cfg, `${a.page_id}/photos`, { method: "POST", token: a.token, params: { url: imageUrl, caption: text } })
      : await graph(cfg, `${a.page_id}/feed`, { method: "POST", token: a.token, params: { message: text, ...(link ? { link } : {}) } });
    const postId = r.post_id || r.id;
    const info = await graph(cfg, postId, { token: a.token, params: { fields: "permalink_url" } }).catch(() => ({}));
    await logPost(a, { task_id: taskId, external_id: postId, permalink: info.permalink_url || null, message: text, image_url: imageUrl, status: "PUBLISHED", created_by: actor });
    return { id: postId, permalink: info.permalink_url || null };
  } catch (err) {
    await logPost(a, { task_id: taskId, message: text, image_url: imageUrl, status: "FAILED", error: err.message.slice(0, 480), created_by: actor });
    if (err.status === 401) await update("social_accounts", a.id, { status: "EXPIRED", last_error: err.message.slice(0, 480) });
    throw err;
  }
}

/** Instagram needs an image (public JPEG/PNG URL). Caption max 2200 chars, 30 hashtags. */
export async function publishInstagram(clientId, { caption, imageUrl, taskId = null, actor = null }) {
  if (!imageUrl || !/^https:\/\//i.test(imageUrl)) throw bad("Instagram posts need a public https image URL.");
  const cfg = await metaConfig();
  const a = await account(clientId, "instagram");
  const text = String(caption || "").slice(0, 2200);
  try {
    const c = await graph(cfg, `${a.ig_user_id}/media`, { method: "POST", token: a.token, params: { image_url: imageUrl, caption: text } });
    // the container processes asynchronously - wait until FINISHED (max ~30 s)
    for (let i = 0; i < 10; i++) {
      const st = await graph(cfg, c.id, { token: a.token, params: { fields: "status_code" } }).catch(() => ({}));
      if (st.status_code === "FINISHED") break;
      if (st.status_code === "ERROR") throw bad("Instagram could not process the image (use JPG/PNG, 4:5 to 1.91:1).");
      await new Promise((r) => setTimeout(r, 3000));
    }
    const pub = await graph(cfg, `${a.ig_user_id}/media_publish`, { method: "POST", token: a.token, params: { creation_id: c.id } });
    const info = await graph(cfg, pub.id, { token: a.token, params: { fields: "permalink" } }).catch(() => ({}));
    await logPost(a, { task_id: taskId, external_id: pub.id, permalink: info.permalink || null, message: text, image_url: imageUrl, status: "PUBLISHED", created_by: actor });
    return { id: pub.id, permalink: info.permalink || null };
  } catch (err) {
    await logPost(a, { task_id: taskId, message: text, image_url: imageUrl, status: "FAILED", error: err.message.slice(0, 480), created_by: actor });
    if (err.status === 401) await update("social_accounts", a.id, { status: "EXPIRED", last_error: err.message.slice(0, 480) });
    throw err;
  }
}

/* ---------------- read posts / insights ---------------- */
export async function facebookPosts(clientId, limit = 12) {
  const cfg = await metaConfig();
  const a = await account(clientId, "facebook");
  const j = await graph(cfg, `${a.page_id}/posts`, { token: a.token, params: { limit, fields: "id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)" } });
  return (j.data || []).map((p) => ({ id: p.id, message: p.message || "", created: p.created_time, permalink: p.permalink_url, image: p.full_picture || null, reactions: p.reactions?.summary?.total_count || 0, comments: p.comments?.summary?.total_count || 0, shares: p.shares?.count || 0 }));
}

export async function instagramMedia(clientId, limit = 12) {
  const cfg = await metaConfig();
  const a = await account(clientId, "instagram");
  const j = await graph(cfg, `${a.ig_user_id}/media`, { token: a.token, params: { limit, fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count" } });
  return (j.data || []).map((m) => ({ id: m.id, message: m.caption || "", created: m.timestamp, permalink: m.permalink, image: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url, reactions: m.like_count || 0, comments: m.comments_count || 0 }));
}

/* ---------------- Instagram DMs ---------------- */
export async function sendInstagramMessage(a, recipientId, text) {
  const cfg = await metaConfig();
  return graph(cfg, `${a.page_id}/messages`, { method: "POST", token: a.token, params: { recipient: { id: recipientId }, message: { text: String(text).slice(0, 1000) }, messaging_type: "RESPONSE" } });
}

export function verifySignature(rawBody, header, appSecret) {
  if (!header || !appSecret) return false;
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(String(header));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export { account as socialAccount };
