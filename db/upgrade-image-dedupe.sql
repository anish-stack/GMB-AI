-- Adds a content hash to task_image_candidates so we can detect the AI (or the
-- deterministic placeholder) handing back the exact same image it already
-- generated for an earlier task of the same client - see orchestrator.js
-- duplicate-image check. Run once on existing installs; fresh installs get
-- this column straight from schema.sql.

ALTER TABLE `task_image_candidates`
  ADD COLUMN `content_hash` VARCHAR(64) NULL AFTER `prompt`;

ALTER TABLE `task_image_candidates`
  ADD KEY `idx_imgcand_hash` (`content_hash`);
