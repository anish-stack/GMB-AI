import { route } from "@/lib/saas/routeKit.js";
import { query } from "@/lib/db";
import { googleProvider } from "@/lib/gmb/provider.js";
import { getIntegration } from "@/lib/integrations/store.js";
import { PUBSUB_TYPES } from "@/lib/reviews/pubsub.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** One representative connected client per Google account (notification settings are per account). */
async function accounts() {
  return query(
    `SELECT MIN(c.id) client_id, c.google_account_id account, COUNT(*) locations
       FROM clients c JOIN gmb_profiles p ON p.client_id=c.id
      WHERE c.google_account_id IS NOT NULL AND (c.gmb_connection_status='GOOGLE_CONNECTED' OR (p.provider='google' AND p.connection_status='GOOGLE_CONNECTED'))
      GROUP BY c.google_account_id`,
  );
}

export const GET = route({ superAdmin: true }, async () => {
  const provider = googleProvider();
  const g = await getIntegration("google");
  const list = await accounts();
  const items = [];
  for (const a of list) {
    try {
      items.push({ ...a, ...(!provider ? { enabled: false } : await provider.getNotificationSettings(a.client_id)) });
    } catch (err) {
      items.push({ ...a, error: err.message });
    }
  }
  return { mock: !provider, topic: g?.values?.pubsub_topic || null, tokenSet: Boolean(g?.values?.pubsub_push_token), items };
});

/** POST { action: "enable" | "disable" } for every connected Google account. */
export const POST = route({ superAdmin: true }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  const provider = googleProvider();
  if (!provider) throw Object.assign(new Error("Google OAuth client ID/secret are not configured."), { status: 400 });
  const g = await getIntegration("google");
  const topic = g?.values?.pubsub_topic;
  if (b.action === "enable" && (!topic || !g?.values?.pubsub_push_token)) throw Object.assign(new Error("Set Pub/Sub topic and push token in Integrations → Google first."), { status: 400 });
  const results = [];
  for (const a of await accounts()) {
    try {
      const r = b.action === "disable"
        ? await provider.disableNotifications(a.client_id)
        : await provider.updateNotificationSettings(a.client_id, { pubsubTopic: topic, notificationTypes: PUBSUB_TYPES });
      results.push({ account: a.account, ok: true, enabled: r.enabled });
    } catch (err) {
      results.push({ account: a.account, ok: false, error: err.message });
    }
  }
  await audit(ctx, b.action === "disable" ? "GBP_NOTIFICATIONS_DISABLED" : "GBP_NOTIFICATIONS_ENABLED", { meta: { accounts: results.length } });
  return { results };
});
