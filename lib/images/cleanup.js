import "server-only";
import { update } from "../db.js";
import { TASK_STATUS } from "../constants.js";
import { deleteImage } from "../storage/index.js";
import { listStaleCandidates, markCandidateDeleted } from "../repo/imageCandidates.js";

const RETENTION_DAYS = Number(process.env.IMAGE_RETENTION_DAYS || 90);
// Safety default: a still-PUBLISHED post's live image is skipped until the
// post is unpublished/deleted, so a routine sweep never breaks a live GMB
// listing. Set IMAGE_RETENTION_SKIP_PUBLISHED=false to delete unconditionally
// after `days` regardless of publish status.
const SKIP_PUBLISHED = String(process.env.IMAGE_RETENTION_SKIP_PUBLISHED ?? "true").toLowerCase() !== "false";

/**
 * Deletes every generated/uploaded image older than `days` (default 90, or
 * IMAGE_RETENTION_DAYS) from wherever it's stored (S3/R2/Cloudinary/disk),
 * and marks the row DELETED. Candidates that were never selected are always
 * fair game; the currently-live image of a PUBLISHED post is skipped by
 * default (see SKIP_PUBLISHED above).
 *
 * Called directly by scripts/scheduler.js (IMAGE_CLEANUP_CRON) - same
 * pattern as the billing sweep, no HTTP hop needed.
 */
export async function cleanupOldImages({ days = RETENTION_DAYS } = {}) {
  const stale = await listStaleCandidates(days);

  let deleted = 0;
  let skippedPublished = 0;
  let failed = 0;

  for (const row of stale) {
    if (SKIP_PUBLISHED && row.status === "SELECTED" && row.task_status === TASK_STATUS.PUBLISHED) {
      skippedPublished++;
      continue;
    }

    let ok = true;
    if (row.storage_provider && row.storage_key) {
      ok = await deleteImage(row.storage_provider, row.storage_key);
    }
    if (!ok) {
      failed++;
      continue;
    }

    await markCandidateDeleted(row.id);
    deleted++;

    // This was the post's live image - the file is gone, so stop pointing at it.
    if (row.status === "SELECTED") {
      await update("ai_tasks", row.task_id, {
        image_url: null,
        image_provider: "expired",
        image_storage_provider: null,
        image_storage_key: null,
      });
    }
  }

  return { days, scanned: stale.length, deleted, skippedPublished, failed };
}
