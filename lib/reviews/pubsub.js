import { one } from "../db.js";
import { providerFor } from "../gmb/provider.js";
import { upsertReviews, onNewReviews } from "./inbox.js";
import { checkListing } from "../gmb/healthMonitor.js";

/**
 * Handles one Pub/Sub push from the Business Profile Notifications API.
 * Payload data (base64 JSON): { type, location: "accounts/A/locations/L", review?: ".../reviews/R", ... }
 */
export async function handleGbpNotification(data) {
  const type = String(data?.type || "");
  const locId = String(data?.location || "").split("/locations/")[1]?.split("/")[0];
  if (!locId) return { ignored: "no location" };
  const client = await one("SELECT id, tenant_id, business_name FROM clients WHERE google_location_name=? LIMIT 1", [`locations/${locId}`]);
  if (!client) return { ignored: "unknown location" };

  if (type === "NEW_REVIEW" || type === "UPDATED_REVIEW") {
    const reviewId = String(data.review || "").split("/reviews/")[1];
    const provider = await providerFor(client.id);
    const items = reviewId ? [await provider.getReview(client.id, reviewId)] : (await provider.getReviews(client.id)).items;
    const fresh = await upsertReviews(client.id, client.tenant_id, items, "PUBSUB");
    await onNewReviews(client.id, client.tenant_id, fresh);
    return { handled: type, fresh: fresh.length };
  }

  if (["GOOGLE_UPDATE", "DUPLICATE_LOCATION", "LOSS_OF_VOICE_OF_MERCHANT", "VOICE_OF_MERCHANT_UPDATED"].includes(type)) {
    const res = await checkListing(client.id, { reason: type });
    if (type === "GOOGLE_UPDATE") {
      const { sendNotification } = await import("../notifications/service.js");
      await sendNotification({
        tenantId: client.tenant_id, type: "WARNING",
        title: `Google edited ${client.business_name}`,
        body: "Google applied an update to this listing. Review and accept or reject it.",
        link: `/gmb/${client.id}?edit=1`, push: true,
      });
    }
    return { handled: type, health: res.status };
  }

  if (type === "NEW_CUSTOMER_MEDIA") {
    const { sendNotification } = await import("../notifications/service.js");
    await sendNotification({ tenantId: client.tenant_id, type: "INFO", title: `New customer photo - ${client.business_name}`, body: "A customer uploaded a photo to the listing.", link: `/gmb/${client.id}?tab=media`, push: false });
    return { handled: type };
  }
  return { ignored: type };
}

export const PUBSUB_TYPES = ["NEW_REVIEW", "UPDATED_REVIEW", "GOOGLE_UPDATE", "DUPLICATE_LOCATION", "LOSS_OF_VOICE_OF_MERCHANT", "NEW_CUSTOMER_MEDIA"];
